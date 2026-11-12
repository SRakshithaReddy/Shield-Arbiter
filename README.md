# ShieldArbiter Case Intelligence Agent

An AI-powered case intelligence service that analyzes transaction, complaint, and evidence information to generate structured recommendations for merchant review.

## What It Does

The agent supports ShieldArbiter's dispute-review workflow by:

- Analyzing transaction and complaint context.
- Reviewing available evidence information.
- Generating structured case recommendations.
- Supporting human decision-making during merchant review.

The agent uses **Mastra**, the **Astropods AI gateway**, and **Claude Sonnet 4.6**.

## Requirements

- [Bun](https://bun.sh/)
- Astropods AI gateway credentials
- ShieldArbiter backend authentication token

## Setup

Install dependencies:

```bash
bun install
```

Configure the required environment variables using your local environment configuration:

- `ASTRO_GATEWAY_URL`
- `ASTRO_GATEWAY_API_KEY`
- `SHIELDARBITER_API_TOKEN`
- `MODEL_DEFAULT` (optional; defaults to `claude-sonnet-4-6`)

Start the agent in development mode:

```bash
bun run dev
```

Or start it directly:

```bash
bun start
```

Check the service logs for its startup status and configured endpoint.

## Backend Integration

The ShieldArbiter backend connects to this agent through its case-analysis endpoint. The agent requires a valid shared authentication token.

Configure the backend connection settings separately. Keep all API keys and authentication tokens in local environment variables.

## Important

- AI recommendations are decision-support outputs, not automatic financial decisions.
- A merchant or authorized reviewer must evaluate recommendations before taking action.
- The AI service must be running and correctly configured for case analysis to work.
- Never commit API keys, tokens, or other secrets.

## Technology

- Mastra
- Astropods AI gateway
- Claude Sonnet 4.6
- Bun
- TypeScript
