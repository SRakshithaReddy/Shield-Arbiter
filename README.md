# ShieldArbiter

**Explainable PayPal Sandbox risk review and AI-assisted pre-dispute case intelligence.**

ShieldArbiter is a merchant-focused prototype that combines transaction risk assessment, complaint handling, evidence tracking, and AI-assisted case recommendations.

## Features

- **PayPal Sandbox integration:** Create and capture test payment orders using PayPal APIs.
- **Transaction risk assessment:** Evaluate transaction indicators using a Python-based rule engine and merchant registry checks.
- **Case management:** Create and manage pre-dispute complaint cases.
- **Evidence tracking:** Store evidence records with hash-linked integrity verification.
- **AI-assisted case intelligence:** Use an Astropods-backed Mastra agent with Claude Sonnet 4.6 to analyze case information and generate structured recommendations.
- **Merchant review:** Keep human review in the decision process before financial actions.
- **Interactive dashboard:** Explore transaction and case information using AG Grid Community.

## Technology Stack

- PayPal Developer Platform — Sandbox Orders and payment operations
- Node.js and Express.js — Backend API
- Python — Risk assessment and evidence analysis
- SQLite — Local application data
- AG Grid Community — Interactive transaction dashboard
- Mastra and Astropods — AI agent integration
- Claude Sonnet 4.6 — Configured AI model

## Project Structure

```text
ShieldArbiter/
├── backend/
├── frontend/
├── risk-ai/
├── shieldarbiter-case-intelligence-agent/
├── INTEGRATION-NOTES.md
├── START-HERE.md
└── README.md
```

## Setup

See [INTEGRATION-NOTES.md](INTEGRATION-NOTES.md) for the current integration status and combined setup instructions.

For backend-specific setup, see [backend/README.md](backend/README.md).

The AI case intelligence service requires Astropods gateway configuration and a shared backend authentication token. Configure credentials locally; never commit secrets.

## Demo and Testing

Use PayPal Sandbox accounts and synthetic test data only. Configure the required environment variables before running the application.

## Limitations

ShieldArbiter is a hackathon prototype, not a production fraud decision system. Risk scores are rule-based indicators, not calibrated fraud probabilities. AI recommendations are decision-support outputs and require human review. Sandbox dispute scenarios may be simulated.

## License

MIT License — see [LICENSE](LICENSE).
