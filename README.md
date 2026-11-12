# ShieldArbiter

An explainable PayPal Sandbox risk review and pre-dispute case workflow prototype.

See [INTEGRATION-NOTES.md](INTEGRATION-NOTES.md) for current capabilities, known limitations and setup instructions.

Project folders:
- `backend/` — Node.js, Express, SQLite and PayPal Sandbox API
- `frontend/` — merchant dashboard using AG Grid Community
- `risk-ai/` — Python risk, registry, data-quality, image-forensics, evidence and arbitration modules

This is a hackathon prototype, not a production fraud decision system. Risk scores are rule-based indicators, not calibrated fraud probabilities. Human review is required for non-approve outcomes and complaint recommendations.
