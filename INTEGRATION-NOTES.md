# ShieldArbiter integration notes

## Current integration stage

This build combines the latest Mriya Node.js/PayPal + AG Grid project with Rakshitha's Python risk and forensics modules.

### Implemented in this build
- Node.js risk adapter invokes the existing Python `modules.risk_engine.calculate_risk()` through `risk-ai/python_bridge.py`.
- The Python result is combined with live merchant-registry matches stored by the Node.js application.
- Order risk is calculated before a PayPal approval URL is returned.
- Only an `APPROVE` decision receives a PayPal approval URL; `/orders/capture` rejects `VERIFY` and `HOLD` orders until an authorized merchant decision changes the order to `APPROVE`.
- Checkout response includes score, decision, signals and Python data-quality assessment.
- Existing AG Grid frontend is retained and checkout messaging explains when merchant review is required.

### Important limitations / next work
- Python registry is a local CSV dataset; Node registry is a separate SQLite registry. Both are consulted, but they are not yet one unified registry or one identifier normalization service.
- `previous_orders` is derived from prior local orders for the supplied email. `failed_attempts` is currently zero because this app does not yet persist a failed-attempt counter.
- Storefront-provided email, device, address and country fields are unverified signals. The app does not currently collect a trustworthy client IP/device fingerprint or geolocation source.
- The Python AI explainer remains deterministic/rule-based. Astropods/model integration is not yet implemented.
- Evidence records are hash chained in SQLite, not immutable against an administrator who can rewrite the database and chain.
- Image forensics currently reports file hash, format, dimensions and available metadata. It is not a definitive image-manipulation detector.
- Merchant overrides require a note, but authentication/authorization must be added before production use.
- PayPal Sandbox credentials and webhook verification must be configured and tested locally. No live payments should be used for the demo.

## Setup

### Backend
1. Install Node.js 18 or newer.
2. Open a terminal in `backend`.
3. Run `npm ci`.
4. Copy `.env.example` to `.env` and fill in PayPal Sandbox credentials. Generate a long random `REGISTRY_SALT`; do not use the example value.
5. Install Python requirements: `python -m pip install -r ../risk-ai/requirements.txt`.
6. Set `PYTHON_EXECUTABLE` in `.env` to the Python executable that has those packages installed. On Windows, a virtual environment path can be used, for example `C:\\path\\to\\venv\\Scripts\\python.exe`.
7. Start backend: `npm run dev`.

### Frontend
Serve the `frontend` folder at the configured `FRONTEND_URL` (default README setup uses port 5500). Backend defaults to port 3000.

## Verification
- Python module test scripts can be run from `risk-ai` using `python -m tests.test_risk_engine` etc.
- Node syntax checks were run for `backend/src/risk.js`, `backend/src/server.js` and `frontend/script.js`.
- The Python bridge was run directly with a synthetic high-risk transaction and returned HIGH/HOLD with exact registry matches.
- A full Node runtime/API integration test is still pending because dependency installation (`npm ci`) did not complete in this build environment. Re-run it on the development machine after `npm ci`.
