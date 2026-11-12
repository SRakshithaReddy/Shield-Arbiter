
const { spawn } = require('child_process');
const path = require('path');
const db = require('./db');
const registry = require('./registry');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_ROOT = path.join(PROJECT_ROOT, 'risk-ai');

async function runPythonRisk(order) {
  const python = process.env.PYTHON_EXECUTABLE ||
    (process.platform === 'win32' ? 'python' : 'python3');

  const payload = JSON.stringify({
    transaction_id: order.id || order.transaction_id,
    email: order.email,
    ip: order.ip || order.ip_address,
    ip_country: order.ip_country,
    ship_country: order.ship_country,
    device_id: order.device_id,
    shipping_address: order.shipping_address,
    amount: Number(order.amount || 0),
    previous_orders: Number(order.previous_orders || 0),
    failed_attempts: Number(order.failed_attempts || 0)
  });

  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [path.join(PYTHON_ROOT, 'python_bridge.py')],
      { cwd: PYTHON_ROOT, windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Python risk engine timed out'));
    }, 90000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);

      if (code !== 0) {
        return reject(
          new Error(`Python risk engine failed: ${stderr || stdout}`)
        );
      }

      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (err) {
        reject(new Error(`Invalid Python risk response: ${err.message}`));
      }
    });

    child.stdin.end(payload);
  });

  if (result.error) throw new Error(result.error);
  return result;
}

function pointsForPythonMatch(match) {
  if (match.match_type !== 'EXACT') return 5;

  const weights = {
    email: { HIGH: 30, MEDIUM: 20, LOW: 10 },
    device_id: { HIGH: 25, MEDIUM: 15, LOW: 5 },
    ip_address: { HIGH: 10, MEDIUM: 5, LOW: 2 }
  };

  return weights[match.identifier_type]?.[
    String(match.severity || '').toUpperCase()
  ] || 0;
}

function pointsForLiveMatch(match) {
  const weights = {
    email: { HIGH: 30, MEDIUM: 20, LOW: 10 },
    device: { HIGH: 25, MEDIUM: 15, LOW: 5 },
    ip: { HIGH: 10, MEDIUM: 5, LOW: 2 },
    address: { HIGH: 10, MEDIUM: 5, LOW: 2 },
    payer_id: { HIGH: 30, MEDIUM: 20, LOW: 10 }
  };

  return weights[match.type]?.[
    String(
      Number(match.severity) >= 70 ? 'HIGH' :
      Number(match.severity) >= 40 ? 'MEDIUM' : 'LOW'
    )
  ] || 0;
}

async function scoreOrder(order) {
  const pythonResult = await runPythonRisk(order);
  const base = pythonResult.risk || {};
  const quality = pythonResult.data_quality || {
    data_quality: 'INCOMPLETE',
    warnings: ['Data quality assessment unavailable.']
  };

  const pythonMatches = base.registry_matches || [];
  const liveMatches = registry.findMatches(order);

  // Keep one registry contribution per identifier type.
  // If both stores flag the same transaction identifier,
  // use the strongest severity rather than adding both scores.
  const registryByType = new Map();

  for (const match of pythonMatches) {
    const type = match.identifier_type;
    if (!type) continue;

    const candidate = {
      ...match,
      source: 'python_registry',
      points: pointsForPythonMatch(match)
    };

    const existing = registryByType.get(type);
    if (!existing || candidate.points > existing.points) {
      registryByType.set(type, candidate);
    }
  }

  for (const match of liveMatches) {
    const typeMap = {
      device: 'device_id',
      ip: 'ip_address',
      email: 'email',
      address: 'shipping_address',
      payer_id: 'payer_id'
    };

    const type = typeMap[match.type] || match.type;

    const candidate = {
      ...match,
      identifier_type: type,
      source: 'merchant_registry',
      points: pointsForLiveMatch(match)
    };

    const existing = registryByType.get(type);

    if (!existing || candidate.points > existing.points) {
      registryByType.set(type, candidate);
    }
  }

  const selectedMatches = [...registryByType.values()];

  const nonRegistrySignals = (base.signals || []).filter(
    signal => !signal.registry_id &&
      !String(signal.signal || '').toLowerCase().includes('registry match')
  );

  const registrySignals = selectedMatches.map(match => ({
    name: 'registry_match',
    points: match.points,
    detail: `${match.match_type || match.match || 'EXACT'} registry match: ${match.identifier_type}`,
    registry_id: match.registry_id || null,
    flag_id: match.flag_id || null,
    source: match.source,
    reason: match.reason || null
  }));

  const basePoints = nonRegistrySignals.reduce(
    (total, signal) => total + Number(signal.points || 0), 0
  );

  const registryPoints = registrySignals.reduce(
    (total, signal) => total + signal.points, 0
  );

  const uncappedScore = basePoints + registryPoints;
  const score = Math.min(100, uncappedScore);

  const incomplete = quality.data_quality !== 'COMPLETE';

  const decision = incomplete
    ? 'VERIFY'
    : score >= 60
      ? 'HOLD'
      : score >= 30
        ? 'VERIFY'
        : 'APPROVE';

  const classification = score >= 60
    ? 'HIGH'
    : score >= 30
      ? 'MEDIUM'
      : 'LOW';

  const signals = [
    ...nonRegistrySignals.map(signal => ({
      name: signal.signal || 'python_risk_signal',
      points: Number(signal.points || 0),
      detail: signal.signal || 'Python risk signal',
      registry_id: signal.registry_id || null
    })),
    ...registrySignals
  ];

  if (incomplete) {
    signals.push({
      name: 'incomplete_transaction_data',
      points: 0,
      detail: 'Transaction information is incomplete; verification is required.',
      warnings: quality.warnings || []
    });
  }

  return {
    risk_score: score,
    classification,
    signals,
    matches: selectedMatches,
    decision,
    explanation: [
      `Risk score ${score}/100.`,
      ...signals.map(signal =>
        `${signal.detail} (+${signal.points})`
      ),
      ...(incomplete
        ? [`Data quality: INCOMPLETE. ${ (quality.warnings || []).join(' ') }`]
        : [])
    ].join(' '),
    data_quality: quality,
    engine: 'python-risk-engine+merchant-registry'
  };
}

function buildPopup(result, direction = 'inbound') {
  if (!result.matches || result.matches.length === 0) return null;

  return {
    direction,
    title: 'Previously flagged payment identifier detected',
    risk_score: result.risk_score,
    matches: result.matches.map(match => ({
      type: match.type || match.identifier_type,
      match: match.match || (match.match_type || '').toLowerCase(),
      reason: match.reason,
      case_id: match.case_id || null,
      flagged_on: match.flagged_on || null
    })),
    note: 'A registry match is a risk indicator, not proof of wrongdoing.',
    actions: ['hold', 'proceed_with_caution', 'mark_false_positive']
  };
}

module.exports = { scoreOrder, buildPopup };
