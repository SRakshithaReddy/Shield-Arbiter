# ShieldArbiter — Integrated project for Mriya

This folder combines Claude's backend with Sahana's original dashboard. The dashboard script is connected to the backend API and includes inbound risk review actions, case creation, and refund/override flow. The transaction explorer now uses **AG Grid Community** (official PayPal AI Hackathon sponsor technology) for sortable, filterable, paginated transaction data, with a native HTML table fallback if the CDN is unavailable. The original dashboard layout is retained.

## 1. Start backend

Open a terminal in `backend`:

```bash
npm install
````

Copy `.env.example` to `.env`, then set `REGISTRY_SALT` to a long random value. Add PayPal Sandbox Client ID and Secret only when testing real Sandbox checkout/capture/refunds. For local frontend use, keep `FRONTEND_ORIGIN=http://localhost:5500,http://127.0.0.1:5500` and `FRONTEND_URL=http://localhost:5500`.

Seed demo records and start: `npm run seed` then `npm start`. The seed script no longer deletes existing data by default. To intentionally rebuild the demo database, use `npm run seed -- --reset`.

## 2. Start frontend

Open `frontend` in VS Code and run `index.html` with Live Server on port 5500. Do not open it as a `file://` URL. The dashboard calls `http://localhost:3000`. Use the “Test a PayPal Sandbox Payment” panel to create a checkout. After the Sandbox buyer approves, PayPal returns to the frontend and the script calls the capture endpoint automatically.

## 3. Sponsor technology: AG Grid Community

The frontend loads the pinned AG Grid Community 32.3.3 UMD bundle and Alpine theme from jsDelivr. It powers the live transaction grid with sorting, per-column filters, a quick-search field, pagination, and a View action connected to the existing transaction-details workflow. The UMD bundle auto-registers Community modules. An HTML table fallback remains available if the CDN cannot be reached. This is a real runtime integration, not just a logo or mention. It requires internet access when the dashboard loads. AG Grid Enterprise features are not used and no Enterprise licence is required.

## 4. Verify

- `http://localhost:3000/health` should return `{ "ok": true, ... }`.
- The dashboard should load the three seeded orders from `GET /orders`.
- Select a transaction to see its risk signals.
- The returning flagged demo order should show an inbound review pop-up.
- Try the three merchant decisions; “Proceed with caution” requires a note.
- Open a case from transaction details. A refund of a flagged account should first return HTTP 409 and require a merchant override note. A real refund requires a genuine PayPal capture ID from a Sandbox payment.
- `GET /evidence/verify` should report an intact chain.

## 5. Important limitations / work still requiring your team or accounts

- PayPal Sandbox credentials, webhook ID, public ngrok/Render URL, and actual Sandbox buyer approval must be supplied and tested by the team. These cannot be fabricated.
- Rakshitha's final risk/matching/AI explanation engine must replace or extend `backend/src/risk.js`; the current engine is a deterministic starter.
- The frontend's current merchant action UI is now connected to backend endpoints, but the actual design/wording should be reviewed with Sahana.
- The backend is a hackathon/demo starter, not production-secure. Add merchant authentication/authorization, rate limiting, stricter validation, persistent production database/backups, and external immutable evidence anchoring before public real-money use.
- Webhook idempotency is added, but the team must still test event delivery and verify the exact event subscriptions in the PayPal Developer Dashboard.
- The case workflow and confirmed-fraud registry update are implemented, but test the complete lifecycle with synthetic data before presenting it.

## 6. Do not commit secrets

`.env` and SQLite database files are ignored by Git. Never share PayPal Client Secret or registry salt.
