# ArticleFlow AI

Stateful AI content publishing agent built with LangGraph, Node.js, TypeScript, PostgreSQL, Redis/BullMQ, OpenAI and Notion.

## Status

ArticleFlow AI is under active development.

**Completed milestones:**

- M0 — Repository Baseline
- M1 — Infrastructure and Application Bootstrap
- M2 — Durable Job Acceptance

**Next milestone:** M3 — Queue, Worker and Minimal LangGraph Execution.

The application currently accepts Telegram article requests durably. Article generation, queue dispatching and publication are not yet implemented.

## Architecture

ArticleFlow AI uses a modular TypeScript application with independent Express API and background-worker processes.

Major modules include:

- `api` — HTTP routes, controllers and middleware
- `application` — Use cases and repository ports
- `domain` — Business rules and domain concepts
- `database` — Prisma Client, PostgreSQL repositories and transactions
- `worker` — Background processing runtime
- `queue` — BullMQ integration (M3)
- `agent` — LangGraph workflow (M3 onward)
- `integrations` — Telegram, OpenAI, search and Notion adapters
- `observability` — Logging, metrics and tracing
- `config` — Typed application configuration

### Current Request Flow

```text
Telegram Webhook
       |
       v
Express Authentication and Validation
       |
       v
Telegram Webhook Controller
       |
       v
Accept Article Request Use Case
       |
       v
Article Acceptance Repository Port
       |
       v
Prisma Repository
       |
       v
PostgreSQL Transaction
  - Upsert User
  - Record Telegram Update
  - Create Agent Job
  - Create Outbox Event
       |
       v
Commit Transaction
       |
       v
HTTP 200 + Telegram sendMessage Response
```

Application use cases depend on interfaces rather than Prisma directly.

The Prisma repository owns persistence implementation and transactional consistency.

PostgreSQL is the canonical source of truth for jobs and business state.

In M3, an outbox dispatcher will publish accepted jobs to BullMQ for asynchronous worker execution.

## Requirements

- Node.js 24.21.0
- npm 12.0.2
- Docker Desktop with Linux containers enabled
- PostgreSQL 17 (Docker Compose)
- Redis 7 (Docker Compose)

## Local Development

### Installation

Install dependencies:

```bash
npm ci
```

Create a local `.env` file from `.env.example`.

Configure the required environment variables:

| Variable                  | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `NODE_ENV`                | development, test or production             |
| `PORT`                    | API HTTP port; default 3000                 |
| `POSTGRES_PASSWORD`       | Local PostgreSQL password                   |
| `DATABASE_URL`            | PostgreSQL URL for host-based development   |
| `DATABASE_URL_DOCKER`     | PostgreSQL URL used by Docker services      |
| `TELEGRAM_WEBHOOK_SECRET` | Authentication secret for Telegram webhooks |

The webhook secret must be a valid, securely generated token matching the application's configuration validation.

Database addresses:

- Host applications: `127.0.0.1:55432`
- Docker services: `postgres:5432`

Do not commit `.env`, `.env.test`, API tokens or database credentials.

### Start Infrastructure

```bash
docker compose up -d postgres redis
docker compose ps
```

Local infrastructure ports:

| Service       | Host Port |
| ------------- | --------- |
| PostgreSQL 17 | 55432     |
| Redis 7       | 6379      |

### Database Setup

Validate the Prisma schema:

```bash
npm run db:validate
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply existing migrations:

```bash
npx prisma migrate deploy
```

Verify database connectivity:

```bash
npm run db:check
```

The initial application migration creates the tables and constraints needed for durable Telegram job acceptance.

### Run API and Worker Locally

Start the API:

```bash
npm run dev:api
```

In another terminal, start the worker:

```bash
npm run dev:worker
```

The worker currently starts and shuts down gracefully but does not execute BullMQ jobs.

### Run with Docker Compose

```bash
docker compose up -d --build api worker
docker compose ps
```

The Compose environment runs the API, worker, PostgreSQL and Redis.

Inspect logs:

```bash
docker compose logs --tail=50 api worker
```

Stop services without deleting persistent data:

```bash
docker compose down
```

Do not use `docker compose down -v` unless intentionally deleting volumes.

Docker volumes provide persistence across ordinary container recreation, but they are not backups. Deleting the PostgreSQL volume may permanently remove local database records.

## API

### Liveness

```http
GET /health/live
```

Expected HTTP 200 response:

```json
{
  "status": "ok",
  "service": "articleflow-api"
}
```

Liveness does not verify PostgreSQL or Redis availability.

### Telegram Webhook

```http
POST /webhooks/telegram
```

Required headers:

```http
Content-Type: application/json
X-Telegram-Bot-Api-Secret-Token: <configured-secret>
```

Example request:

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 10,
    "from": {
      "id": 987654321
    },
    "chat": {
      "id": 987654321
    },
    "text": "/article Explain distributed transactions"
  }
}
```

For a successfully accepted article request, the API returns HTTP 200 with a Telegram-compatible Bot API response:

```json
{
  "method": "sendMessage",
  "chat_id": "987654321",
  "text": "Article request accepted.\nJob ID: <generated-job-uuid>\nStatus: awaiting processing."
}
```

The same Telegram update ID resolves to the same persisted job ID when delivered again with the same sender and chat information.

The success response is generated only after the PostgreSQL transaction commits.

Telegram's inline webhook response mechanism does not provide independent confirmation that the outgoing message was delivered.

### Error Handling

The API uses request-ID correlation and structured Pino logging.

Recognized temporary PostgreSQL dependency failures return HTTP 503:

```json
{
  "error": {
    "code": "DEPENDENCY_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "requestId": "<generated-request-id>"
  }
}
```

Unexpected application failures return HTTP 500 with `INTERNAL_ERROR`.

Missing and invalid webhook secrets both return HTTP 401 with a generic `Unauthorized` message.

Malformed requests and unsupported content types are rejected before job acceptance.

Internal database errors, connection details and secrets are not intentionally exposed in public HTTP responses.

## API Testing — Node.js and Postman

### Node.js CLI

From the project root, using the local `.env` file:

```cmd
node --env-file=.env --input-type=module -e "const body={update_id:Date.now(),message:{message_id:10,from:{id:987654321},chat:{id:987654321},text:'/article Explain distributed transactions'}};for(let i=1;i<=2;i++){const r=await fetch('http://localhost:3000/webhooks/telegram',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':process.env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(body)});console.log(i,r.status,await r.text());}"
```

Both requests should return HTTP 200 and the same job identifier inside the acknowledgement text.

### Postman

Create a local environment with:

| Variable           | Value                              |
| ------------------ | ---------------------------------- |
| `baseUrl`          | `http://localhost:3000`            |
| `telegramSecret`   | Local Telegram webhook secret      |
| `telegramUpdateId` | A unique integer update identifier |

Configure:

- Method: `POST`
- URL: `{{baseUrl}}/webhooks/telegram`
- Header: `Content-Type: application/json`
- Header: `X-Telegram-Bot-Api-Secret-Token: {{telegramSecret}}`
- Body: Raw JSON containing a valid Telegram article update

A Pre-request script can generate a fresh update ID:

```javascript
pm.environment.set('telegramUpdateId', String(Date.now()));
```

Use `{{telegramUpdateId}}` as the unquoted JSON number in the request body.

For a duplicate test, resend the same payload without regenerating the update ID.

Postman verifies the HTTP response contract. It does not simulate actual message delivery by Telegram.

Do not export or commit Postman environments containing real secrets.

## Quality Assurance

Run formatting, linting, type checking, unit tests, HTTP integration tests and build:

```bash
npm run check
```

Database integration tests run separately:

```bash
npm run test:db:local
```

Database tests require an isolated PostgreSQL database named `articleflow_test`, accessible through the ignored `.env.test` configuration with `NODE_ENV=test`.

Apply migrations to that test database before running the database suite.

The test suite covers:

- Telegram authentication and payload validation
- Successful and duplicate HTTP webhook acceptance
- Atomic PostgreSQL job and outbox persistence
- Concurrent duplicate deliveries
- Unique-constraint handling
- PostgreSQL error classification
- Safe HTTP 500/503 error responses
- Request-ID correlation

GitHub Actions additionally validates database migrations, runs PostgreSQL integration tests, builds the Docker image and performs API/worker smoke tests.

## Completed Milestones

### M1 — Infrastructure and Application Bootstrap

Implemented:

- Strict TypeScript and NodeNext ESM configuration
- Express 5 API and independent worker runtimes
- Zod environment validation
- Pino structured logging
- Graceful process shutdown
- Docker Compose with PostgreSQL 17 and Redis 7
- Prisma 7 and the PostgreSQL driver adapter
- Multi-stage Docker build and non-root containers
- API liveness and Docker health checks
- Persistent infrastructure volumes
- GitHub Actions quality and container smoke tests

### M2 — Durable Job Acceptance

Implemented:

- Authenticated Telegram webhook ingestion
- Validated Telegram update parsing
- Controller, application use case and repository separation
- Prisma migration for user, update, job and outbox entities
- Atomic PostgreSQL job acceptance
- Idempotent duplicate handling
- Concurrent request integration tests
- Telegram-compatible job acknowledgement response
- Centralized typed API error handling
- HTTP request-ID correlation
- Redis-independent acceptance

Verified locally:

- Repeated Telegram updates resolve to one logical job
- Job and outbox records are committed together
- Accepted jobs survive API restarts
- New article requests can be accepted while Redis is unavailable
- PostgreSQL outages return safe, retryable HTTP failures
- Recognized Prisma transaction startup timeouts are classified
  as temporary dependency failures

## Current Limitations and Next Milestone

M2 accepts and persists jobs but does not execute them.

M3 will introduce:

- Transactional outbox dispatcher
- BullMQ queues and job contracts
- Redis-backed background work delivery
- Background worker execution
- Minimal multi-node LangGraph workflow
- Article result persistence
- Telegram workflow completion notification

The full product will additionally require planning, research, review, revision, human approval and verified Notion publication.

Telegram `/start`, `/help`, `/status` and interactive approval flows are not yet complete.

Actual Telegram delivery through a public HTTPS webhook has not yet been verified.

Prometheus metrics, OpenTelemetry distributed tracing, trace propagation through API/outbox/BullMQ/worker/LangGraph, and Grafana/Tempo observability remain required milestones. Early request and job identifiers support subsequent correlation and instrumentation.
