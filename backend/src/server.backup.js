
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');
const paypal = require('./paypal');
const registry = require('./registry');
const evidence = require('./evidence');

const { scoreOrder, buildPopup } = require('./risk');
const { runPythonOperation } = require('./python_runner');

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true
}));

app.use(express.json({ limit: '5mb' }));

// ---------- Image Upload ----------

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG and WebP images are allowed.'));
    }

    cb(null, true);
  }
});

// ---------- Helpers ----------

const parse = row => row && ({
  ...row,
  signals: row.signals ? JSON.parse(row.signals) : [],
  matches: row.matches ? JSON.parse(row.matches) : [],
  popup: row.popup ? JSON.parse(row.popup) : null
});

const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(error => {
    console.error(error.message);

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        error: error.message
      });
    }
  });

function getCaseDetails(caseRow) {
  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(caseRow.order_id);

  return {
    ...caseRow,
    recommendation: caseRow.recommendation
      ? JSON.parse(caseRow.recommendation)
      : null,
    order: parse(order),
    evidence: evidence.listEvidence(caseRow.id)
  };
}

// ---------- Health ----------

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString()
  });
});

// ---------- Orders ----------

app.post('/orders/create', wrap(async (req, res) => {
  const {
    amount,
    currency = 'USD',
    email,
    ip,
    ip_country,
    ship_country,
    device_id,
    shipping_address
  } = req.body;

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({
      error: 'amount must be a positive number'
    });
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({
      error: 'currency must be a 3-letter uppercase code'
    });
  }

  const previous_orders = email
    ? db.prepare(
        'SELECT COUNT(*) AS n FROM orders WHERE lower(email) = lower(?)'
      ).get(email).n
    : 0;

  const risk = await scoreOrder({
    email,
    ip,
    ip_country,
    ship_country,
    device_id,
    shipping_address,
    amount,
    previous_orders,
    failed_attempts: 0
  });

  const popup = buildPopup(risk, 'inbound');
  const order = await paypal.createOrder(amount, currency);

  db.prepare(
    `INSERT INTO orders
    (id, email, ip, ip_country, ship_country, device_id,
     shipping_address, amount, currency, status, risk_score,
     signals, matches, decision, popup)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, ?, ?)`
  ).run(
    order.id,
    email || null,
    ip || null,
    ip_country || null,
    ship_country || null,
    device_id || null,
    shipping_address || null,
    amount,
    currency,
    risk.risk_score,
    JSON.stringify(risk.signals),
    JSON.stringify(risk.matches),
    risk.decision,
    popup ? JSON.stringify(popup) : null
  );

  const approve = (order.links || []).find(
    link => link.rel === 'approve' || link.rel === 'payer-action'
  );

  const approvalAllowed = risk.decision === 'APPROVE';

  res.json({
    order_id: order.id,
    approve_url: approvalAllowed && approve ? approve.href : null,
    risk_score: risk.risk_score,
    decision: risk.decision,
    classification: risk.classification,
    signals: risk.signals,
    data_quality: risk.data_quality,
    message: approvalAllowed
      ? 'Risk review passed configured rules.'
      : 'Merchant review is required before payment capture.'
  });
}));

app.post('/orders/capture', wrap(async (req, res) => {
  const { order_id } = req.body;

  const row = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(order_id);

  if (!row) {
    return res.status(404).json({ error: 'unknown order' });
  }

  if (row.capture_id) {
    return res.json(parse(row));
  }

  if (row.decision !== 'APPROVE') {
    return res.status(409).json({
      error: `Payment capture blocked: merchant review required (current decision: ${row.decision || 'PENDING'}).`,
      decision: row.decision,
      risk_score: row.risk_score
    });
  }

  const cap = await paypal.captureOrder(order_id);
  const capture = cap.purchase_units?.[0]?.payments?.captures?.[0];

  db.prepare(
    'UPDATE orders SET email=?, payer_id=?, capture_id=?, status=? WHERE id=?'
  ).run(
    cap.payer?.email_address || row.email,
    cap.payer?.payer_id || null,
    capture?.id || null,
    cap.status,
    order_id
  );

  evidence.addEvidence(
    0,
    'payment_capture',
    {
      order_id,
      capture_id: capture?.id || null,
      status: cap.status
    },
    'PayPal capture completed after pre-capture risk review'
  );

  res.json(
    parse(db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id))
  );
}));

app.get('/orders', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM orders ORDER BY created_at DESC')
      .all()
      .map(parse)
  );
});

app.get('/orders/:id', (req, res) => {
  const row = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'not found' });
  }

  res.json(parse(row));
});

app.post('/orders/:id/decision', (req, res) => {
  const { action, note } = req.body;

  const row = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'not found' });
  }

  if (
    ['proceed_with_caution', 'mark_false_positive'].includes(action) &&
    (!note || !note.trim())
  ) {
    return res.status(400).json({
      error: 'a non-empty merchant note is required for this override'
    });
  }

  const decisions = {
    hold: 'HOLD',
    proceed_with_caution: 'APPROVE',
    mark_false_positive: 'APPROVE'
  };

  if (!decisions[action]) {
    return res.status(400).json({ error: 'invalid action' });
  }

  db.prepare(
    'UPDATE orders SET decision = ? WHERE id = ?'
  ).run(decisions[action], req.params.id);

  evidence.addEvidence(
    0,
    'merchant_decision',
    {
      order: req.params.id,
      action,
      note: note || null
    },
    note || 'Merchant retained hold'
  );

  if (action === 'mark_false_positive') {
    for (const match of JSON.parse(row.matches || '[]')) {
      if (match.flag_id) registry.clearFlag(match.flag_id);
    }
  }

  res.json(
    parse(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id))
  );
});

// ---------- PayPal Webhooks ----------

app.post('/webhooks/paypal', wrap(async (req, res) => {
  const event = req.body;

  const ok = await paypal.verifyWebhook(req.headers, event);

  if (!ok) {
    return res.status(400).json({
      error: 'webhook verification failed'
    });
  }

  if (!event.id || !event.event_type) {
    return res.status(400).json({
      error: 'webhook event id/type missing'
    });
  }

  const alreadySeen = db.prepare(
    'SELECT event_id FROM webhook_events WHERE event_id = ?'
  ).get(event.id);

  if (alreadySeen) {
    return res.status(200).json({
      received: true,
      duplicate: true
    });
  }

  db.prepare(
    'INSERT INTO webhook_events (event_id, event_type) VALUES (?, ?)'
  ).run(event.id, event.event_type);

  evidence.addEvidence(
    0,
    `webhook:${event.event_type}`,
    event,
    event.summary || ''
  );

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const orderId =
      event.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      db.prepare(
        "UPDATE orders SET status='COMPLETED' WHERE id=?"
      ).run(orderId);
    }
  }

  if (
    event.event_type === 'PAYMENT.CAPTURE.REFUNDED' ||
    event.event_type === 'PAYMENT.REFUND.COMPLETED'
  ) {
    db.prepare(
      "UPDATE orders SET status='REFUNDED' WHERE capture_id=?"
    ).run(event.resource?.id);
  }

  res.sendStatus(200);
}));

// ---------- Cases ----------

// NEW: Retrieve all cases dynamically.

app.get('/cases', (req, res) => {
  const cases = db.prepare(
    'SELECT * FROM cases ORDER BY created_at DESC, id DESC'
  ).all();

  res.json(
    cases.map(getCaseDetails)
  );
});

// Create a complaint case.

app.post('/cases', (req, res) => {
  const { order_id, complaint } = req.body;

  if (!db.prepare('SELECT id FROM orders WHERE id=?').get(order_id)) {
    return res.status(404).json({ error: 'unknown order' });
  }

  const result = db.prepare(
    'INSERT INTO cases (order_id, complaint) VALUES (?, ?)'
  ).run(order_id, complaint || '');

  evidence.addEvidence(
    result.lastInsertRowid,
    'complaint',
    complaint || '',
    'Buyer complaint opened (pre-dispute window)'
  );

  res.json({
    case_id: result.lastInsertRowid
  });
});

// Attach text evidence.

app.post('/cases/:id/evidence', (req, res) => {
  const { type = 'note', content, note } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content required' });
  }

  const caseRow = db.prepare(
    'SELECT id FROM cases WHERE id=?'
  ).get(req.params.id);

  if (!caseRow) {
    return res.status(404).json({ error: 'Case not found' });
  }

  res.json(
    evidence.addEvidence(
      Number(req.params.id),
      type,
      content,
      note || ''
    )
  );
});

// ---------- Image Forensics ----------

app.post(
  '/cases/:id/image-forensics',
  (req, res, next) => {
    imageUpload.single('image')(req, res, error => {
      if (error) {
        return res.status(400).json({
          error: error.message
        });
      }
      next();
    });
  },
  wrap(async (req, res) => {
    const caseId = Number(req.params.id);

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return res.status(400).json({ error: 'Invalid case ID' });
    }

    const caseRow = db.prepare(
      'SELECT id, status FROM cases WHERE id=?'
    ).get(caseId);

    if (!caseRow) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseRow.status === 'RESOLVED') {
      return res.status(409).json({
        error: 'Cannot add evidence to a resolved case'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Upload an image using the image field'
      });
    }

    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    const extension = extensions[req.file.mimetype];
    const buffer = req.file.buffer;

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const isWebp =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    const valid =
      (req.file.mimetype === 'image/jpeg' && isJpeg) ||
      (req.file.mimetype === 'image/png' && isPng) ||
      (req.file.mimetype === 'image/webp' && isWebp);

    if (!valid) {
      return res.status(400).json({
        error: 'File content does not match its declared image type'
      });
    }

    const tempPath = path.join(
      os.tmpdir(),
      `shieldarbiter-${crypto.randomUUID()}${extension}`
    );

    try {
      fs.writeFileSync(tempPath, buffer, { flag: 'wx' });

      const analysis = await runPythonOperation({
        operation: 'image_forensics',
        file_path: tempPath
      });

      const storedEvidence = evidence.addEvidence(
        caseId,
        'image_forensics',
        {
          filename: path.basename(req.file.originalname),
          mime_type: req.file.mimetype,
          file_size_bytes: req.file.size,
          sha256: analysis.sha256,
          analysis
        },
        'Image analyzed by Python forensic metadata module'
      );

      res.json({
        case_id: caseId,
        analysis,
        evidence: storedEvidence
      });
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  })
);

// ---------- Arbitration ----------

// Manual recommendation storage.

app.post('/cases/:id/recommendation', (req, res) => {
  const caseRow = db.prepare(
    'SELECT id FROM cases WHERE id=?'
  ).get(req.params.id);

  if (!caseRow) {
    return res.status(404).json({ error: 'Case not found' });
  }

  db.prepare(
    'UPDATE cases SET recommendation=? WHERE id=?'
  ).run(JSON.stringify(req.body), req.params.id);

  evidence.addEvidence(
    Number(req.params.id),
    'ai_recommendation',
    req.body,
    'Manually supplied recommendation'
  );

  res.json({ ok: true });
});

// Run Python arbitration for any open case.

app.post('/cases/:id/arbitrate', wrap(async (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'Invalid case ID' });
  }

  const c = db.prepare(
    'SELECT * FROM cases WHERE id=?'
  ).get(caseId);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (c.status === 'RESOLVED') {
    return res.status(409).json({
      error: 'Case is already resolved'
    });
  }
if (c.proposed_action === 'REFUND_PROPOSAL') {
  return res.status(409).json({
    error: 'Policy-based refunds must use the merchant approval workflow'
  });
}

if (c.proposed_action === 'REFUND_PROPOSAL') {
  return res.status(409).json({
    error: 'Policy-based refunds must use the merchant approval workflow'
  });
}
  const order = db.prepare(
    'SELECT * FROM orders WHERE id=?'
  ).get(c.order_id);

  if (!order) {
    return res.status(404).json({
      error: 'Linked order not found'
    });
  }

  if (!req.body.complaint_type) {
    return res.status(400).json({
      error: 'complaint_type is required'
    });
  }

  const result = await runPythonOperation({
    operation: 'arbitration',
    complaint: {
      complaint_id: `CASE-${c.id}`,
      transaction_id: order.id,
      complaint_type: req.body.complaint_type,
      delivery_status: req.body.delivery_status,
      evidence_available: req.body.evidence_available
    }
  });

  db.prepare(
    'UPDATE cases SET recommendation=? WHERE id=?'
  ).run(JSON.stringify(result), caseId);

  evidence.addEvidence(
    caseId,
    'arbitration_recommendation',
    result,
    'Python rule-based arbitration recommendation; human review required'
  );

  res.json({
    case_id: caseId,
    ...result,
    engine: 'python-rule-based-arbitration'
  });
}));


// ---------- Astropods AI Case Analysis ----------

app.post('/cases/:id/ai-analysis', wrap(async (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'Invalid case ID' });
  }

  const caseRow = db.prepare(
    'SELECT * FROM cases WHERE id = ?'
  ).get(caseId);

  if (!caseRow) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (caseRow.status === 'RESOLVED') {
    return res.status(409).json({
      error: 'Case is already resolved'
    });
  }

  const details = getCaseDetails(caseRow);

  if (!details.order) {
    return res.status(404).json({
      error: 'Linked order not found'
    });
  }

  const aiUrl = process.env.ASTROPODS_AI_URL;
  const aiToken = process.env.ASTROPODS_API_TOKEN;

  if (!aiUrl || !aiToken) {
    return res.status(503).json({
      error: 'Astropods AI configuration is missing'
    });
  }

  const order = details.order;

  // Send relevant case information, not raw buyer identifiers.
  const caseData = {
    case_id: caseRow.id,
    transaction_id: caseRow.order_id,
    complaint: caseRow.complaint || '',
    case_status: caseRow.status,

    transaction: {
      amount: order.amount,
      currency: order.currency,
      payment_status: order.status,
      risk_score: order.risk_score,
      risk_signals: order.signals || [],
      registry_matches: order.matches || []
    },

    evidence: details.evidence.map(item => ({
      id: item.id,
      type: item.type,
      note: item.note,
      content_hash: item.content_hash,
      entry_hash: item.entry_hash,
      created_at: item.created_at
    }))
  };

  const aiResponse = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caseData }),
    signal: AbortSignal.timeout(90000)
  });

  const responseBody = await aiResponse.json();

  if (!aiResponse.ok || !responseBody.success) {
    console.error('Astropods AI error:', responseBody);

    return res.status(502).json({
      error: 'Astropods AI analysis failed',
      upstream_status: aiResponse.status
    });
  }

  const analysis = responseBody.analysis;

  if (!analysis || !analysis.recommended_action) {
    return res.status(502).json({
      error: 'Invalid AI analysis response'
    });
  }

  const recommendation = {
    ...analysis,
    engine: responseBody.engine,
    analyzed_at: new Date().toISOString(),
    requires_human_review: true
  };

  // Save the AI recommendation against this case.
  db.prepare(
    'UPDATE cases SET recommendation = ? WHERE id = ?'
  ).run(JSON.stringify(recommendation), caseId);

  // Record the recommendation in the tamper-evident evidence chain.
  evidence.addEvidence(
    caseId,
    'ai_recommendation',
    recommendation,
    'Astropods AI case analysis; human review required'
  );

  return res.json({
    success: true,
    case_id: caseId,
    engine: responseBody.engine,
    analysis: recommendation
  });
}));


// Retrieve one case.

app.get('/cases/:id', (req, res) => {
  const c = db.prepare(
    'SELECT * FROM cases WHERE id=?'
  ).get(req.params.id);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  res.json(getCaseDetails(c));
});

// ---------- Case Resolution ----------

app.post('/cases/:id/resolve', wrap(async (req, res) => {
  const {
    amount,
    confirm_override = false,
    override_note = '',
    outcome = 'REFUNDED'
  } = req.body;

  const c = db.prepare(
    'SELECT * FROM cases WHERE id=?'
  ).get(req.params.id);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (c.status === 'RESOLVED') {
    return res.status(409).json({ error: 'Case already resolved' });
  }

  const order = db.prepare(
    'SELECT * FROM orders WHERE id=?'
  ).get(c.order_id);

  const matches = registry.findMatches(order);

  if (matches.length && !confirm_override) {
    return res.status(409).json({
      blocked: true,
      reason: 'Refund recipient matches flagged registry',
      popup: buildPopup(
        { risk_score: order.risk_score, matches },
        'outbound'
      )
    });
  }

  if (matches.length && !override_note) {
    return res.status(400).json({
      error: 'override_note required to refund a flagged account'
    });
  }

  if (matches.length) {
    evidence.addEvidence(
      c.id,
      'override',
      { matches, override_note },
      `Merchant override: ${override_note}`
    );
  }

  const allowed = [
    'REFUNDED',
    'CONFIRMED_FRAUD',
    'CLEARED',
    'NO_ACTION'
  ];

  if (!allowed.includes(outcome)) {
    return res.status(400).json({ error: 'invalid outcome' });
  }

  let refund = null;

  if (outcome === 'REFUNDED') {
    if (!order.capture_id) {
      return res.status(400).json({
        error: 'order has no capture to refund'
      });
    }

    refund = await paypal.refundCapture(
      order.capture_id,
      amount,
      order.currency
    );

    evidence.addEvidence(
      c.id,
      'refund',
      refund,
      `Refund ${refund.status}`
    );

    db.prepare(
      "UPDATE orders SET status='REFUNDED' WHERE id=?"
    ).run(order.id);
  }

  if (outcome === 'CONFIRMED_FRAUD') {
    const identifiers = [
      ['email', order.email],
      ['payer_id', order.payer_id],
      ['device', order.device_id],
      ['ip', order.ip],
      ['address', order.shipping_address]
    ].filter(([, value]) => value);

    const alreadyFlagged = registry.findMatches(order)
      .map(m => `${m.type}:${m.flag_id}`);

    for (const [type, value] of identifiers) {
      const exists = registry.lookup(type, value).length > 0;

      if (!exists) {
        registry.addFlag({
          type,
          value,
          reason: `Confirmed fraud in case #${c.id}`,
          severity: 90,
          case_id: c.id
        });
      }
    }

    evidence.addEvidence(
      c.id,
      'registry_update',
      {
        identifiers: identifiers.map(([type]) => type),
        existing_matches: alreadyFlagged
      },
      'Identifiers added to flagged registry after confirmed fraud outcome'
    );
  }

  db.prepare(
    "UPDATE cases SET status='RESOLVED', outcome=? WHERE id=?"
  ).run(outcome, c.id);

  res.json({
    ok: true,
    outcome,
    refund
  });
}));

// ---------- Flagged Registry ----------

app.get('/flags', (req, res) => {
  res.json(registry.listFlags());
});

app.post('/flags', (req, res) => {
  const { type, value, reason, severity, case_id } = req.body;

  if (!type || !value || !reason) {
    return res.status(400).json({
      error: 'type, value, reason required'
    });
  }

  const id = registry.addFlag({
    type,
    value,
    reason,
    severity,
    case_id
  });

  res.json({ flag_id: id });
});

app.post('/flags/:id/clear', (req, res) => {
  res.json({
    cleared: registry.clearFlag(Number(req.params.id))
  });
});

// ---------- Evidence Integrity ----------

app.get('/evidence/verify', (req, res) => {
  res.json(evidence.verifyChain());
});

// ---------- PayPal Redirects ----------

app.get('/paypal/return', (req, res) => {
  res.send(
    `Approved. Now call POST /orders/capture with order_id = ${req.query.token}`
  );
});

app.get('/paypal/cancel', (req, res) => {
  res.send('Payment cancelled.');
});


// ---------- Merchant Compensation Policies ----------

const ALLOWED_COMPLAINT_TYPES = [
  'DELAYED_DELIVERY',
  'ITEM_NOT_RECEIVED',
  'DAMAGED_ITEM',
  'WRONG_ITEM',
  'OTHER'
];

const ALLOWED_COMPENSATION_TYPES = [
  'NONE',
  'FIXED',
  'PERCENTAGE'
];

function validatePolicy(data) {
  const errors = [];

  if (!data.name || !String(data.name).trim()) {
    errors.push('Policy name is required');
  }

  if (!ALLOWED_COMPLAINT_TYPES.includes(data.complaint_type)) {
    errors.push('Invalid complaint_type');
  }

  if (
    !Number.isInteger(Number(data.min_delay_days)) ||
    Number(data.min_delay_days) < 0
  ) {
    errors.push('min_delay_days must be a non-negative integer');
  }

  if (
    data.max_delay_days !== null &&
    data.max_delay_days !== undefined &&
    (
      !Number.isInteger(Number(data.max_delay_days)) ||
      Number(data.max_delay_days) < Number(data.min_delay_days)
    )
  ) {
    errors.push('max_delay_days must be greater than or equal to min_delay_days');
  }

  if (!ALLOWED_COMPENSATION_TYPES.includes(data.compensation_type)) {
    errors.push('Invalid compensation_type');
  }

  const value = Number(data.compensation_value);
  const maximum = Number(data.max_compensation);

  if (!Number.isFinite(value) || value < 0) {
    errors.push('compensation_value must be a non-negative number');
  }

  if (!Number.isFinite(maximum) || maximum < 0) {
    errors.push('max_compensation must be a non-negative number');
  }

  if (data.compensation_type === 'PERCENTAGE' && value > 100) {
    errors.push('Percentage compensation cannot exceed 100');
  }

  if (data.compensation_type === 'NONE' && value !== 0) {
    errors.push('NONE compensation must have a value of 0');
  }

  if (
    data.currency &&
    !/^[A-Z]{3}$/.test(data.currency)
  ) {
    errors.push('Currency must be a three-letter uppercase code');
  }

  return errors;
}

// View merchant policies.
app.get('/policies', (req, res) => {
  const policies = db.prepare(
    'SELECT * FROM merchant_policies ORDER BY id DESC'
  ).all();

  res.json({
    success: true,
    count: policies.length,
    policies
  });
});

// Create a merchant policy.
app.post('/policies', (req, res) => {
  const data = req.body;

  const policy = {
    name: String(data.name || '').trim(),
    complaint_type: data.complaint_type,
    min_delay_days: Number(data.min_delay_days),
    max_delay_days:
      data.max_delay_days === null ||
      data.max_delay_days === undefined ||
      data.max_delay_days === ''
        ? null
        : Number(data.max_delay_days),
    compensation_type: data.compensation_type || 'NONE',
    compensation_value: Number(data.compensation_value ?? 0),
    max_compensation: Number(data.max_compensation ?? 0),
    currency: data.currency || 'USD',
    response_template: data.response_template || '',
    active: data.active === false ? 0 : 1,
    requires_approval: 1
  };

  const errors = validatePolicy(policy);

  if (errors.length) {
    return res.status(400).json({
      success: false,
      errors
    });
  }

  const result = db.prepare(`
    INSERT INTO merchant_policies (
      name,
      complaint_type,
      min_delay_days,
      max_delay_days,
      compensation_type,
      compensation_value,
      max_compensation,
      currency,
      response_template,
      active,
      requires_approval
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    policy.name,
    policy.complaint_type,
    policy.min_delay_days,
    policy.max_delay_days,
    policy.compensation_type,
    policy.compensation_value,
    policy.max_compensation,
    policy.currency,
    policy.response_template,
    policy.active
  );

  const created = db.prepare(
    'SELECT * FROM merchant_policies WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({
    success: true,
    policy: created
  });
});

// Update a merchant policy.
app.patch('/policies/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid policy ID' });
  }

  const existing = db.prepare(
    'SELECT * FROM merchant_policies WHERE id = ?'
  ).get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  const allowedFields = [
    'name',
    'complaint_type',
    'min_delay_days',
    'max_delay_days',
    'compensation_type',
    'compensation_value',
    'max_compensation',
    'currency',
    'response_template',
    'active'
  ];

  const updated = { ...existing };

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updated[field] = req.body[field];
    }
  }

  updated.name = String(updated.name || '').trim();
  updated.min_delay_days = Number(updated.min_delay_days);
  updated.max_delay_days =
    updated.max_delay_days === null ||
    updated.max_delay_days === ''
      ? null
      : Number(updated.max_delay_days);
  updated.compensation_value = Number(updated.compensation_value);
  updated.max_compensation = Number(updated.max_compensation);
  updated.active = updated.active ? 1 : 0;

  const errors = validatePolicy(updated);

  if (errors.length) {
    return res.status(400).json({
      success: false,
      errors
    });
  }

  db.prepare(`
    UPDATE merchant_policies
    SET
      name = ?,
      complaint_type = ?,
      min_delay_days = ?,
      max_delay_days = ?,
      compensation_type = ?,
      compensation_value = ?,
      max_compensation = ?,
      currency = ?,
      response_template = ?,
      active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    updated.name,
    updated.complaint_type,
    updated.min_delay_days,
    updated.max_delay_days,
    updated.compensation_type,
    updated.compensation_value,
    updated.max_compensation,
    updated.currency,
    updated.response_template,
    updated.active,
    id
  );

  res.json({
    success: true,
    policy: db.prepare(
      'SELECT * FROM merchant_policies WHERE id = ?'
    ).get(id)
  });
});


// ---------- Merchant Policy Evaluation ----------

app.post('/cases/:id/evaluate-policy', (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'Invalid case ID' });
  }

  const c = db.prepare(
    'SELECT * FROM cases WHERE id = ?'
  ).get(caseId);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (c.status === 'RESOLVED') {
    return res.status(409).json({
      error: 'Case is already resolved'
    });
  }

if (c.proposed_action === 'REFUND_PROPOSAL') {
  return res.status(409).json({
    error: 'Policy-based refunds must use the merchant approval workflow'
  });
}

  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(c.order_id);

  if (!order) {
    return res.status(404).json({
      error: 'Linked order not found'
    });
  }

  const complaintType = String(
    req.body.complaint_type || c.complaint_type || ''
  ).toUpperCase();

  if (!ALLOWED_COMPLAINT_TYPES.includes(complaintType)) {
    return res.status(400).json({
      error: 'A valid complaint_type is required',
      allowed_types: ALLOWED_COMPLAINT_TYPES
    });
  }

  const delayDays = Number(
    req.body.delivery_delay_days ?? c.delivery_delay_days ?? 0
  );

  if (
    !Number.isInteger(delayDays) ||
    delayDays < 0
  ) {
    return res.status(400).json({
      error: 'delivery_delay_days must be a non-negative integer'
    });
  }

  if (
    complaintType === 'DELAYED_DELIVERY' &&
    req.body.delivery_delay_days === undefined &&
    c.delivery_delay_days === null
  ) {
    return res.status(400).json({
      error: 'delivery_delay_days is required for delayed delivery complaints'
    });
  }

  const policies = db.prepare(`
    SELECT *
    FROM merchant_policies
    WHERE active = 1
      AND complaint_type = ?
      AND min_delay_days <= ?
      AND (max_delay_days IS NULL OR max_delay_days >= ?)
      AND currency = ?
    ORDER BY min_delay_days DESC
  `).all(
    complaintType,
    delayDays,
    delayDays,
    order.currency || 'USD'
  );

  // No matching merchant policy: escalate for human review.
  if (policies.length === 0) {
    const result = {
      complaint_type: complaintType,
      delivery_delay_days: delayDays,
      proposed_action: 'MANUAL_REVIEW',
      proposed_compensation: null,
      approval_status: 'NOT_REQUIRED',
      resolution_status: 'ESCALATED',
      reason: 'No active merchant policy matches this complaint.'
    };

    db.prepare(`
      UPDATE cases
      SET complaint_type = ?,
          delivery_delay_days = ?,
          proposed_action = ?,
          proposed_compensation = NULL,
          customer_response = NULL,
          resolution_status = ?,
          approval_status = ?
      WHERE id = ?
    `).run(
      complaintType,
      delayDays,
      result.proposed_action,
      result.resolution_status,
      result.approval_status,
      caseId
    );

    evidence.addEvidence(
      caseId,
      'policy_escalation',
      result,
      'No matching merchant compensation policy; escalated for human review'
    );

    return res.json({
      success: true,
      case_id: caseId,
      ...result
    });
  }

  // Multiple matching policies are ambiguous.
  if (policies.length > 1) {
    const result = {
      complaint_type: complaintType,
      delivery_delay_days: delayDays,
      proposed_action: 'MANUAL_REVIEW',
      proposed_compensation: null,
      approval_status: 'NOT_REQUIRED',
      resolution_status: 'ESCALATED',
      reason: 'Multiple active merchant policies match this complaint. Policy selection requires review.',
      matching_policy_ids: policies.map(policy => policy.id)
    };

    db.prepare(`
      UPDATE cases
      SET complaint_type = ?,
          delivery_delay_days = ?,
          proposed_action = ?,
          proposed_compensation = NULL,
          customer_response = NULL,
          resolution_status = ?,
          approval_status = ?
      WHERE id = ?
    `).run(
      complaintType,
      delayDays,
      result.proposed_action,
      result.resolution_status,
      result.approval_status,
      caseId
    );

    evidence.addEvidence(
      caseId,
      'policy_escalation',
      result,
      'Overlapping merchant policies require human selection'
    );

    return res.json({
      success: true,
      case_id: caseId,
      ...result
    });
  }

  const policy = policies[0];
  const orderAmount = Number(order.amount);

  if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
    return res.status(400).json({
      error: 'Order amount is invalid'
    });
  }

  let compensation = 0;

  if (policy.compensation_type === 'FIXED') {
    compensation = Math.min(
      Number(policy.compensation_value),
      Number(policy.max_compensation),
      orderAmount
    );
  } else if (policy.compensation_type === 'PERCENTAGE') {
    compensation = Math.min(
      orderAmount * Number(policy.compensation_value) / 100,
      Number(policy.max_compensation),
      orderAmount
    );
  }

  compensation = Math.round((compensation + Number.EPSILON) * 100) / 100;

  const proposedAction =
    compensation > 0 ? 'REFUND_PROPOSAL' : 'POLICY_RESPONSE';

  const defaultResponse = compensation > 0
    ? `We apologize for the inconvenience. Your complaint meets our compensation policy. A ${order.currency} ${compensation.toFixed(2)} refund has been proposed and is awaiting merchant approval.`
    : 'We have reviewed your complaint against our merchant policy. We will provide an update regarding your request.';

  const customerResponse =
    policy.response_template || defaultResponse;

  const result = {
    complaint_type: complaintType,
    delivery_delay_days: delayDays,
    matched_policy: {
      id: policy.id,
      name: policy.name,
      compensation_type: policy.compensation_type,
      compensation_value: policy.compensation_value,
      max_compensation: policy.max_compensation,
      currency: policy.currency
    },
    proposed_action: proposedAction,
    proposed_compensation: compensation,
    currency: order.currency || 'USD',
    customer_response: customerResponse,
    approval_status: 'PENDING',
    resolution_status: 'AWAITING_APPROVAL',
    requires_merchant_approval: true
  };

  db.prepare(`
    UPDATE cases
    SET complaint_type = ?,
        delivery_delay_days = ?,
        proposed_action = ?,
        proposed_compensation = ?,
        customer_response = ?,
        resolution_status = ?,
        approval_status = ?
    WHERE id = ?
  `).run(
    complaintType,
    delayDays,
    proposedAction,
    compensation,
    customerResponse,
    result.resolution_status,
    result.approval_status,
    caseId
  );

  evidence.addEvidence(
    caseId,
    'policy_evaluation',
    result,
    'Merchant policy evaluated; proposed action requires merchant approval'
  );

  return res.json({
    success: true,
    case_id: caseId,
    ...result
  });
});


// ---------- Merchant Refund Approval Workflow ----------

// Merchant approves a policy-generated refund proposal
app.post('/cases/:id/approve-refund', wrap(async (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'Invalid case ID' });
  }

  const c = db.prepare(
    'SELECT * FROM cases WHERE id = ?'
  ).get(caseId);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (c.status === 'RESOLVED') {
    return res.status(409).json({ error: 'Case already resolved' });
  }

  if (c.proposed_action !== 'REFUND_PROPOSAL') {
    return res.status(400).json({
      error: 'This case has no refund proposal'
    });
  }

  if (!['PENDING', 'FAILED'].includes(c.approval_status)) {
    return res.status(409).json({
      error: `Refund cannot be approved from status: ${c.approval_status}`
    });
  }

  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(c.order_id);

  if (!order || !order.capture_id) {
    return res.status(400).json({
      error: 'A valid PayPal capture is required'
    });
  }

  if (order.status !== 'COMPLETED') {
    return res.status(400).json({
      error: 'Order must have COMPLETED payment status'
    });
  }

  const amount = Number(c.proposed_compensation);
  const currency = c.currency || order.currency;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      error: 'Invalid proposed refund amount'
    });
  }

  if (!currency || currency !== order.currency) {
    return res.status(400).json({
      error: 'Refund currency does not match the order'
    });
  }

  const requestId = `shieldarbiter-case-${caseId}-refund-v1`;

  // Claim the refund operation before contacting PayPal.
  const claim = db.transaction(() => {
    const existing = db.prepare(
      'SELECT * FROM refund_operations WHERE capture_id = ?'
    ).get(order.capture_id);

    if (existing) {
      if (existing.case_id !== caseId) {
        return { error: 'This capture is already linked to another refund operation' };
      }

      if (existing.status === 'COMPLETED' ||
          existing.status === 'PROCESSING') {
        return { error: `Refund operation is already ${existing.status}` };
      }

      if (existing.request_id !== requestId) {
        return { error: 'Refund request ID mismatch' };
      }

      db.prepare(`
        UPDATE refund_operations
        SET status = 'PROCESSING',
            updated_at = datetime('now')
        WHERE case_id = ?
      `).run(caseId);
    } else {
      db.prepare(`
        INSERT INTO refund_operations
          (case_id, capture_id, request_id, amount, currency, status)
        VALUES (?, ?, ?, ?, ?, 'PROCESSING')
      `).run(
        caseId,
        order.capture_id,
        requestId,
        amount,
        currency
      );
    }

    db.prepare(`
      UPDATE cases
      SET approval_status = 'PROCESSING',
          refund_status = 'PROCESSING',
          refund_request_id = ?
      WHERE id = ?
    `).run(requestId, caseId);

    return { success: true };
  });

  const claimResult = claim();

  if (claimResult.error) {
    return res.status(409).json({
      error: claimResult.error
    });
  }

  evidence.addEvidence(
    caseId,
    'refund_approval',
    {
      approved: true,
      amount,
      currency,
      request_id: requestId
    },
    'Merchant approved policy-generated refund'
  );

  try {
    const refund = await paypal.refundCapture(
      order.capture_id,
      amount,
      currency,
      'Merchant-approved ShieldArbiter compensation',
      requestId
    );

    const refundStatus = refund.status || 'PENDING';
    const completed = refundStatus === 'COMPLETED';

    db.prepare(`
      UPDATE refund_operations
      SET status = ?,
          paypal_refund_id = ?,
          response_json = ?,
          updated_at = datetime('now')
      WHERE case_id = ?
    `).run(
      completed ? 'COMPLETED' : 'PENDING',
      refund.id || null,
      JSON.stringify(refund),
      caseId
    );

    db.prepare(`
      UPDATE cases
      SET approval_status = 'APPROVED',
          refund_id = ?,
          refund_status = ?,
          resolution_status = ?,
          status = ?,
          outcome = ?
      WHERE id = ?
    `).run(
      refund.id || null,
      refundStatus,
      completed ? 'RESOLVED' : 'REFUND_PENDING',
      completed ? 'RESOLVED' : 'OPEN',
      completed ? 'REFUNDED' : null,
      caseId
    );

    if (completed) {
      db.prepare(
        "UPDATE orders SET status = 'REFUNDED' WHERE id = ?"
      ).run(order.id);
    }

    evidence.addEvidence(
      caseId,
      'refund',
      refund,
      `Merchant-approved PayPal refund: ${refundStatus}`
    );

    return res.json({
      success: true,
      message: completed
        ? 'Refund completed successfully'
        : 'Refund submitted and is awaiting completion',
      case_id: caseId,
      refund_id: refund.id || null,
      refund_status: refundStatus,
      amount,
      currency
    });

  } catch (err) {
    db.prepare(`
      UPDATE refund_operations
      SET status = 'FAILED',
          response_json = ?,
          updated_at = datetime('now')
      WHERE case_id = ?
    `).run(
      JSON.stringify({ error: err.message }),
      caseId
    );

    db.prepare(`
      UPDATE cases
      SET approval_status = 'FAILED',
          refund_status = 'FAILED',
          resolution_status = 'REFUND_FAILED'
      WHERE id = ?
    `).run(caseId);

    evidence.addEvidence(
      caseId,
      'refund_failure',
      { error: err.message, request_id: requestId },
      'PayPal refund attempt failed'
    );

    throw err;
  }
}));

// Merchant rejects a policy-generated refund proposal
app.post('/cases/:id/reject-refund', wrap(async (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'Invalid case ID' });
  }

  const c = db.prepare(
    'SELECT * FROM cases WHERE id = ?'
  ).get(caseId);

  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  if (c.status === 'RESOLVED') {
    return res.status(409).json({ error: 'Case already resolved' });
  }

  if (c.proposed_action !== 'REFUND_PROPOSAL' ||
      c.approval_status !== 'PENDING') {
    return res.status(409).json({
      error: 'No pending refund proposal to reject'
    });
  }

  const reason = String(req.body.reason || 'Rejected by merchant');

  db.prepare(`
    UPDATE cases
    SET approval_status = 'REJECTED',
        resolution_status = 'REJECTED'
    WHERE id = ?
  `).run(caseId);

  evidence.addEvidence(
    caseId,
    'refund_rejected',
    { reason },
    `Merchant rejected refund proposal: ${reason}`
  );

  return res.json({
    success: true,
    case_id: caseId,
    approval_status: 'REJECTED',
    resolution_status: 'REJECTED',
    message: 'Refund proposal rejected. No PayPal refund was issued.'
  });
}));

// ---------- Error Handler ----------

app.use((err, req, res, next) => {
  console.error(err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// ---------- Server ----------

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`ShieldArbiter backend running on :${port}`);
  });
}

module.exports = app;
