# ShieldArbiter Backend

Explainable fraud shield and pre-dispute micro-arbitrator for PayPal merchants (PayPal AI Hackathon).
This folder is the **backend**: PayPal sandbox integration, webhooks, flagged registry, evidence hash chain, refunds.

## Quick start
```bash
npm install
cp .env.example .env      # then fill in your sandbox keys
npm run seed              # loads the demo story (fraud case, returning buyer, clean order)
npm start                 # http://localhost:3000
```
Requires Node 18+.

## Get PayPal sandbox keys
1. developer.paypal.com > Log in > **Apps & Credentials** > **Sandbox** > Create App.
2. Copy **Client ID** and **Secret** into `.env`.
3. Webhooks: expose the server (`ngrok http 3000` or deploy on Render), then in the app add the webhook
   `https://YOUR-URL/webhooks/paypal` with events `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`,
   `PAYMENT.CAPTURE.REFUNDED`. Copy the **Webhook ID** into `.env` as `PAYPAL_WEBHOOK_ID`.
4. Set `BASE_URL` to the public backend URL and `FRONTEND_URL` to the public frontend URL. For local development, `FRONTEND_URL=http://localhost:5500`.

## Test the full flow
1. `POST /orders/create` with `{"amount":25,"email":"buyer@example.com","ip_country":"US","ship_country":"US","device_id":"d1"}`
   returns an `approve_url`. Open it and log in with a sandbox **Personal** account to pay.
2. `POST /orders/capture` with `{"order_id":"..."}` captures the payment and returns the risk score, signals, decision, and a `popup` if a flagged identifier matched.
3. `POST /cases` with `{"order_id":"...","complaint":"..."}` opens a pre-dispute case.
4. `POST /cases/:id/resolve` refunds via PayPal. If the account is in the flagged registry it returns **409 with an outbound popup**; resend with `{"confirm_override":true,"override_note":"reason"}` to proceed.
5. `GET /evidence/verify` checks the tamper-evident chain.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | /health | Server check |
| POST | /orders/create | Create PayPal order |
| POST | /orders/capture | Capture, score, build popup |
| GET | /orders, /orders/:id | List / detail |
| POST | /orders/:id/decision | Pop-up actions: hold, proceed_with_caution (note required), mark_false_positive |
| POST | /webhooks/paypal | Verified PayPal events |
| POST | /cases | Open pre-dispute case |
| POST | /cases/:id/evidence | Add evidence (hashed and chained) |
| POST | /cases/:id/recommendation | Store AI arbitrator output |
| GET | /cases/:id | Case, order, evidence timeline |
| POST | /cases/:id/resolve | Refund with outbound flagged check |
| GET/POST | /flags | List / add flagged identifiers |
| POST | /flags/:id/clear | Clear a false positive |
| GET | /evidence/verify | Hash chain integrity |

## AI Case Intelligence

ShieldArbiter includes an Astropods-backed Mastra Case Intelligence Agent configured to use Claude Sonnet 4.6 through the AI gateway.

To enable AI case analysis, configure these variables in the backend `.env` file:

```env
ASTROPODS_AI_URL=
ASTROPODS_API_TOKEN=
```

- `ASTROPODS_AI_URL`: URL of the running AI agent service.
- `ASTROPODS_API_TOKEN`: Shared authentication token used by the backend to authenticate with the agent.

Start and configure the AI agent separately before calling:

`POST /cases/:id/ai-analysis`

If the AI service is unavailable or its configuration is missing, the endpoint cannot provide an AI analysis.

AI recommendations are decision-support outputs and must be reviewed by a human before financial actions are taken. Never commit API keys or authentication tokens.

## Design notes
- The registry stores **salted hashes**, never raw personal data. Emails are normalized (Gmail dots and `+tags` removed).
- "Flagged" means higher risk, not guilt. Overrides require a note and are logged in the evidence chain.
- IP, device, and country signals come from the storefront (PayPal does not provide them).
- Sandbox may not support creating real disputes; dispute data is simulated and labeled as such.
- Risk logic lives in `src/risk.js`. Swap `scoreOrder()` for the full engine, keeping the input/output shape.
- Use sandbox accounts and synthetic data only.

## Deploy on Render
New Web Service > connect repo > Build: `npm install` > Start: `npm start` > add env vars from `.env.example`.
SQLite on Render's free tier resets on redeploy: run `npm run seed` after deploying, or attach a disk and set `DB_PATH`.

## License
MIT


Frontend sponsor integration: the companion frontend uses AG Grid Community for its live transaction explorer. See the project root `START-HERE.md` for details.
