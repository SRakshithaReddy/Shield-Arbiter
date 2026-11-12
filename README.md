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

## Application Screenshots

Explore the ShieldArbiter application through screenshots of its payment, transaction monitoring, risk intelligence, case management, and AI-assisted dispute-resolution workflows.

### 1. Main Dashboard — Payment and Risk Overview

![ShieldArbiter Dashboard](screenshots/Payment%20and%20Risk%20Overview.png)

### 2. PayPal Sandbox Checkout

![PayPal Sandbox Checkout](screenshots/PayPal%20Sandbox%20Checkout.png)

### 3. Recent Transactions Explorer

![Recent Transactions](screenshots/Recent%20Transactions%20Explorer.png)

### 4. Transaction Risk Intelligence

![Transaction Risk Intelligence](screenshots/Transaction%20Risk%20Intelligence.png)

### 5. Customer Case Management

![Customer Case Management](screenshots/Customer%20Case%20Management.png)

### 6. Case Details — Transaction and Complaint Information

![Case Details](screenshots/Case%20Details%20%E2%80%94%20Transaction%20and%20Complaint%20Information.png)

### 7. AI-Assisted Case Analysis

![AI-Assisted Case Analysis](screenshots/AI-Assisted%20Case%20Analysis.png)

### 8. Case Summary and AI Rationale

![Case Summary and AI Rationale](screenshots/Case%20Summary%20and%20AI%20Rationale.png)

### 9. Evidence Analysis and Missing Information

![Evidence Analysis](screenshots/Evidence%20Analysis%20and%20Missing%20Information.png)

### 10. Evidence History — Case #10

![Evidence History Case 10](screenshots/Evidence%20History%20%E2%80%94%20Case%20%2310.png)

### 11. Case Details — Case #8

![Case Details Case 8](screenshots/Case%20Details%20%E2%80%94%20Case%20%238.png)

### 12. Evidence Analysis — Case #8

![Evidence Analysis Case 8](screenshots/Evidence%20Analysis%20%E2%80%94%20Case%20%238.png)

### 13. Complete Evidence History — Case #8

![Complete Evidence History](screenshots/Complete%20Evidence%20History%20%E2%80%94%20Case%20%238.png)

### 14. AI Recommendation and Refund Status — Case #8

![AI Recommendation and Refund Status](screenshots/AI%20Recommendation%20and%20Refund%20Status%20%E2%80%94%20Case%20%238.png)

### 15. AI Case Summary and Decision Rationale — Case #8

![AI Case Summary and Decision Rationale](screenshots/AI%20Case%20Summary%20and%20Decision%20Rationale%20%E2%80%94%20Case%20%238.png)

## License

This project is part of ShieldArbiter. See the repository's root `LICENSE` file for licensing information.
