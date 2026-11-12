# ShieldArbiter Case Intelligence Agent

An AI-powered case intelligence service for ShieldArbiter that analyzes transaction details, customer complaints, and supporting evidence to generate structured recommendations for merchant review.

## Overview

The ShieldArbiter Case Intelligence Agent supports merchants in reviewing payment disputes and pre-dispute cases. It uses AI to interpret available case information and provide recommendations that assist human decision-making.

Built using **Mastra**, the **Astropods AI Gateway**, and **Claude Sonnet 4.6**, the agent is designed to support explainable, human-reviewed dispute resolution.

## Key Capabilities

- **Transaction Analysis:** Evaluates transaction information and associated risk indicators.
- **Complaint Analysis:** Examines customer complaints and their reported issues.
- **Evidence Review:** Considers available evidence and supporting case information.
- **Case Recommendations:** Generates structured recommendations to assist merchant review.
- **Human Oversight:** Keeps final dispute and financial decisions under authorized human control.

## Technology Stack

- Mastra
- Astropods AI Gateway
- Claude Sonnet 4.6
- Bun
- TypeScript

## Requirements

- [Bun](https://bun.sh/)
- Configured Astropods AI Gateway credentials
- ShieldArbiter backend authentication token

## Setup and Installation

**1. Install dependencies**

```bash
bun install
```

**2. Configure environment variables**

Set the following variables in your local environment:

| Variable | Purpose |
|---|---|
| `ASTRO_GATEWAY_URL` | Astropods AI Gateway URL |
| `ASTRO_GATEWAY_API_KEY` | AI Gateway authentication key |
| `SHIELDARBITER_API_TOKEN` | Shared authentication token |
| `MODEL_DEFAULT` | AI model selection (optional; defaults to `claude-sonnet-4-6`) |

Keep all credentials and tokens private. Do not commit them to GitHub.

**3. Start the agent**

Development mode:

```bash
bun run dev
```

Direct startup:

```bash
bun start
```

Check the service logs to confirm startup and identify the configured endpoint.

## Backend Integration

The agent is designed to integrate with the ShieldArbiter Node.js backend through the case-analysis endpoint:

`POST /cases/:id/ai-analysis`

The backend sends relevant transaction, complaint, and evidence information to the configured AI service and receives structured recommendations.

The integration requires:

- A running and correctly configured agent service.
- `ASTROPODS_AI_URL` and `ASTROPODS_API_TOKEN` in the backend environment.
- A matching authentication configuration between the backend and agent.

The AI analysis endpoint cannot operate until these services and credentials are configured.

## Responsible AI and Human Oversight

- AI-generated recommendations are intended for decision support.
- Recommendations do not constitute automatic financial decisions.
- Merchants or authorized reviewers must evaluate the recommendations before taking action.
- AI output should be considered alongside transaction records and available evidence.

## Demo Video

Watch the ShieldArbiter project demonstration:

[Watch the ShieldArbiter Demo](https://youtu.be/MYeyQhxGbkQ?si=ZsQLLsrAEj-2teg8)

## License

This project is part of ShieldArbiter. See the repository's root `LICENSE` file for licensing information.
