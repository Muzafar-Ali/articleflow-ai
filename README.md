# ArticleFlow AI

Stateful AI content publishing agent built with LangGraph, Node.js, TypeScript, PostgreSQL, Redis/BullMQ, OpenAI and Notion.

## Status

ArticleFlow AI is currently under active development.

**Current milestone:** M1 — Infrastructure and Application Bootstrap (Completed).

## Architecture

ArticleFlow AI uses a modular TypeScript repository with separate API and background-worker runtime processes.

Major application modules:

- API
- Worker
- Agent / LangGraph
- Domain
- Application
- Database
- Queue
- Integrations
- Validation
- Observability
- Configuration

Some modules are planned for subsequent milestones.

PostgreSQL owns durable application and business state.

Prisma 7 provides database access using the PostgreSQL driver adapter.

BullMQ and Redis will provide asynchronous work delivery, retries, and background processing.

LangGraph will own workflow orchestration, routing, checkpoints, and human-in-the-loop execution.

## Requirements

- Node.js 24.21.0
- npm 12.0.2
- Docker Desktop with Linux containers enabled

## Local Development

### Prerequisites

- Node.js 24.21.0
- npm 12.0.2
- Docker Desktop with Linux containers enabled

### Installation

```bash
npm ci
```

Create `.env` from `.env.example` and configure the required environment variables.

Important local configuration:

| Variable            | Description                                |
| ------------------- | ------------------------------------------ |
| NODE_ENV            | development, test, or production           |
| PORT                | Express API port (default: 3000)           |
| POSTGRES_PASSWORD   | Local PostgreSQL password                  |
| DATABASE_URL        | PostgreSQL URL for host-based development  |
| DATABASE_URL_DOCKER | PostgreSQL URL for Docker Compose services |

Use these database addresses:

- Host application: `127.0.0.1:55432`
- Docker application: `postgres:5432`

Do not commit `.env` or real credentials.

### Start Infrastructure

```bash
docker compose up -d postgres redis
docker compose ps
```

Local infrastructure:

| Service       | Host Port |
| ------------- | --------- |
| PostgreSQL 17 | 55432     |
| Redis 7       | 6379      |

Persistent Docker volumes retain PostgreSQL and Redis data.

### Run the API and Worker Locally

Generate Prisma Client:

```bash
npm run db:generate
```

Start the API:

```bash
npm run dev:api
```

Start the worker in a separate terminal:

```bash
npm run dev:worker
```

API liveness endpoint:

```text
GET http://localhost:3000/health/live
```

Expected response:

```json
{
  "status": "ok",
  "service": "articleflow-api"
}
```

Verify database connectivity:

```bash
npm run db:check
```

### Run with Docker Compose

Build and start the application services:

```bash
docker compose up -d --build api worker
```

This starts four services:

- API — Express HTTP server
- Worker — independent Node.js process
- PostgreSQL — relational database
- Redis — infrastructure for future BullMQ processing

Check container status:

```bash
docker compose ps
```

Inspect application logs:

```bash
docker compose logs --tail=50 api worker
```

Verify Prisma connectivity inside Docker:

```bash
docker compose exec worker node dist/database/check-connection.js
```

Stop application services:

```bash
docker compose stop api worker
```

Stop all services while preserving volumes:

```bash
docker compose down
```

Do not use `docker compose down -v` unless intentionally deleting the persistent database and Redis volumes.

### Database Tooling

Validate the Prisma schema:

```bash
npm run db:validate
```

Generate Prisma Client:

```bash
npm run db:generate
```

Verify database connectivity:

```bash
npm run db:check
```

The application uses Prisma 7 with the PostgreSQL driver adapter.

Business entities and their migrations will be introduced in later milestones.

### Quality Assurance

Run all local quality gates:

```bash
npm run check
```

This runs:

- Prettier formatting verification
- ESLint with strict TypeScript rules
- TypeScript type checking
- Jest unit and HTTP integration tests
- Compiled application build

GitHub Actions additionally performs:

- Locked dependency installation
- Production dependency security audit
- Prisma schema validation and client generation
- PostgreSQL connectivity verification
- Production Docker image build
- API container startup and shutdown smoke test
- Worker container startup and shutdown smoke test

### M1 — Infrastructure and Application Bootstrap

Completed capabilities:

- Modular TypeScript application structure
- Independent API and worker runtimes
- Express 5 HTTP server
- Zod-validated environment configuration
- Pino structured JSON logging
- SIGINT/SIGTERM graceful process shutdown
- PostgreSQL 17 and Redis 7 with Docker Compose
- Prisma 7 database client and PostgreSQL adapter
- Real PostgreSQL connectivity verification
- Multi-stage Docker build
- Non-root application containers
- API Docker health check
- Persistent infrastructure volumes
- GitHub Actions CI with PostgreSQL integration and Docker smoke tests

### Current Limitations

M1 establishes the application and infrastructure foundation.
It does not yet implement the full content publishing workflow.

- The background worker currently supports process startup and
  graceful shutdown but does not process BullMQ jobs.
- Redis is running, but background job delivery and retries
  are not yet implemented.
- The `/health/live` endpoint checks HTTP process liveness,
  not PostgreSQL or Redis readiness.
- Prisma connectivity is implemented, but business models and
  application database migrations have not yet been introduced.
- Telegram ingestion, durable job processing, LangGraph workflows,
  human approval, and Notion publishing remain future milestones.

These capabilities will be implemented and verified incrementally.

- Persistent infrastructure volumes
- GitHub
