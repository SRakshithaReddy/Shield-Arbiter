
const BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

let cached = { token: null, exp: 0 };

async function getAccessToken() {
  if (cached.token && Date.now() < cached.exp) {
    return cached.token;
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`PayPal token error: ${JSON.stringify(data)}`);
  }

  cached = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in - 60) * 1000
  };

  return cached.token;
}

async function ppFetch(path, options = {}) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = new Error(
      `PayPal API ${res.status}: ${JSON.stringify(data)}`
    );
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

// Create a PayPal Sandbox order
async function createOrder(
  amount,
  currency = 'USD',
  description = 'ShieldArbiter demo order'
) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const frontendUrl = process.env.FRONTEND_URL || baseUrl;

  return ppFetch('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description,
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2)
          }
        }
      ],
      application_context: {
        return_url: `${frontendUrl}/?paypal_return=1`,
        cancel_url: `${frontendUrl}/?paypal_cancel=1`,
        user_action: 'PAY_NOW'
      }
    })
  });
}

// Capture a PayPal order
async function captureOrder(orderId) {
  return ppFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'PayPal-Request-Id': `capture-${orderId}`
    },
    body: '{}'
  });
}

// Refund a captured PayPal payment
async function refundCapture(
  captureId,
  amount,
  currency = 'USD',
  note = 'Resolved via ShieldArbiter',
  requestId = null
) {
  const body = {
    note_to_payer: note
  };

  if (amount !== undefined && amount !== null) {
    body.amount = {
      value: Number(amount).toFixed(2),
      currency_code: currency
    };
  }

  return ppFetch(`/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'PayPal-Request-Id':
        requestId || `refund-${captureId}-${Date.now()}`
    },
    body: JSON.stringify(body)
  });
}

// Verify that a webhook came from PayPal
async function verifyWebhook(headers, event) {
  if (process.env.SKIP_WEBHOOK_VERIFY === 'true') {
    return true;
  }

  const data = await ppFetch(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event
      })
    }
  );

  return data.verification_status === 'SUCCESS';
}

module.exports = {
  createOrder,
  captureOrder,
  refundCapture,
  verifyWebhook
};
