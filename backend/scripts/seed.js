require('dotenv').config();

const db = require('../src/db');
const registry = require('../src/registry');
const evidence = require('../src/evidence');
const { scoreOrder, buildPopup } = require('../src/risk');

async function main() {
  // Preserve existing records. Create the original demo story only if absent.
  let first = db.prepare("SELECT * FROM orders WHERE id = 'DEMO-ORDER-1'").get();

  if (!first) {
    db.prepare(`INSERT INTO orders
      (id,email,payer_id,ip,ip_country,ship_country,device_id,shipping_address,
       amount,currency,status,capture_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        'DEMO-ORDER-1', 'fraud.ster+1@gmail.com', 'PAYERFRAUD01',
        '203.0.113.9', 'RU', 'US', 'dev-aaa111',
        '12 Fake St Springfield', 480, 'USD', 'COMPLETED', 'DEMO-CAP-1'
      );

    const caseExists = db.prepare(
      "SELECT id FROM cases WHERE order_id = 'DEMO-ORDER-1'"
    ).get();

    if (!caseExists) {
      const caseId = db.prepare(
        `INSERT INTO cases (order_id,complaint,status,outcome)
         VALUES (?,?,?,?)`
      ).run(
        'DEMO-ORDER-1',
        'Item not received (fake claim)',
        'RESOLVED',
        'CONFIRMED_FRAUD'
      ).lastInsertRowid;

      evidence.addEvidence(
        caseId, 'complaint',
        'Item not received (fake claim)',
        'Original complaint'
      );

      evidence.addEvidence(
        caseId, 'screenshot_check',
        { exif: 'edited with image editor', verdict: 'doctored' },
        'Synthetic demo evidence metadata'
      );
    }

    const flags = [
      ['email', 'fraudster1@gmail.com', 'Doctored payment screenshot + fake claim', 80],
      ['payer_id', 'PAYERFRAUD01', 'Confirmed refund abuse', 90],
      ['device', 'dev-aaa111', 'Device used in confirmed fraud', 70]
    ];

    for (const [type, value, reason, severity] of flags) {
      if (!registry.lookup(type, value).length) {
        registry.addFlag({ type, value, reason, severity });
      }
    }

    first = db.prepare(
      "SELECT * FROM orders WHERE id = 'DEMO-ORDER-1'"
    ).get();
  }

  const demos = [
    {
      id: 'DEMO-ORDER-1',
      email: first.email,
      payer_id: first.payer_id,
      ip: first.ip,
      ip_country: first.ip_country,
      ship_country: first.ship_country,
      device_id: first.device_id,
      shipping_address: first.shipping_address,
      amount: first.amount,
      currency: first.currency || 'USD',
      previous_orders: 0,
      failed_attempts: 0
    },
    {
      id: 'DEMO-ORDER-2',
      email: 'Fraud.Ster+new@gmail.com',
      payer_id: 'PAYERFRAUD01',
      ip: '198.51.100.4',
      ip_country: 'NG',
      ship_country: 'US',
      device_id: 'dev-bbb222',
      shipping_address: '99 Other Rd',
      amount: 520,
      currency: 'USD',
      previous_orders: 0,
      failed_attempts: 0
    },
    {
      id: 'DEMO-ORDER-3',
      email: 'happy.buyer@example.com',
      payer_id: 'PAYERGOOD01',
      ip: '192.0.2.10',
      ip_country: 'US',
      ship_country: 'US',
      device_id: 'dev-ccc333',
      shipping_address: '1 Main St',
      amount: 45,
      currency: 'USD',
      previous_orders: 5,
      failed_attempts: 0
    }
  ];

  for (const order of demos) {
    const result = await scoreOrder(order);
    const popup = buildPopup(result, 'inbound');

    const existing = db.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).get(order.id);

    if (existing) {
      db.prepare(`UPDATE orders SET
        risk_score=?, signals=?, matches=?, decision=?, popup=?
        WHERE id=?`).run(
          result.risk_score,
          JSON.stringify(result.signals),
          JSON.stringify(result.matches),
          result.decision,
          popup ? JSON.stringify(popup) : null,
          order.id
        );
    } else {
      db.prepare(`INSERT INTO orders
        (id,email,payer_id,ip,ip_country,ship_country,device_id,
         shipping_address,amount,currency,status,capture_id,
         risk_score,signals,matches,decision,popup)
        VALUES (?,?,?,?,?,?,?,?,?,?,'COMPLETED',?,?,?,?,?,?)`).run(
          order.id, order.email, order.payer_id, order.ip,
          order.ip_country, order.ship_country, order.device_id,
          order.shipping_address, order.amount, order.currency,
          `DEMO-CAP-${order.id.slice(-1)}`,
          result.risk_score,
          JSON.stringify(result.signals),
          JSON.stringify(result.matches),
          result.decision,
          popup ? JSON.stringify(popup) : null
        );
    }

    console.log(
      `${order.id}: ${result.risk_score}/100 | ${result.decision}`
    );
  }

  console.log('Demo records updated. Existing database was preserved.');
  console.log('Evidence chain:', evidence.verifyChain());
}

main().catch(error => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
