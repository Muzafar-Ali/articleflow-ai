# ArticleFlow AI

Stateful AI content publishing agent built with LangGraph,
Node.js, TypeScript, PostgreSQL, Redis/BullMQ, OpenAI and Notion.

## Status

ArticleFlow AI is currently under active development.

Current milestone: M0 — Repository Baseline.

## Architecture

ArticleFlow AI uses a single modular TypeScript repository with separate
API and background-worker runtime processes.

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

PostgreSQL will own durable product state.

BullMQ and Redis will provide asynchronous work delivery.

LangGraph will own workflow orchestration, routing, checkpoints and
human-in-the-loop execution.

## Requirements

- Node.js 24.21.0
- npm 12.x

## Installation

```bash
npm ci
```

## Local Development

### Prerequisites

- Node.js 24.21.0
- npm 12.x
- Docker Desktop with Linux containers enabled

### Install Dependencies

```bash
npm ci
```

### Environment Configuration

Copy `.env.example` to `.env` and configure the required
environment variables.

Do not commit `.env` or application credentials.

### Start Infrastructure

```bash
docker compose up -d postgres redis
```

The local infrastructure includes:

| Service       | Host Address    |
| ------------- | --------------- |
| PostgreSQL 17 | localhost:55432 |
| Redis 7       | localhost:6379  |

PostgreSQL uses port 5432 inside the Docker network.

Verify container health:

```bash
docker compose ps
docker compose exec postgres pg_isready -U articleflow -d articleflow
docker compose exec redis redis-cli ping
```

Stop infrastructure without deleting persistent volumes:

```bash
docker compose down
```

### Start the API

```bash
npm run dev:api
```

The API listens on port 3000 by default.

Liveness endpoint:

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

### Background Worker

ArticleFlow AI uses separate API and background-worker processes.

Start the development worker:

```bash
npm run dev:worker
```

The worker uses shared Zod-validated configuration and Pino
structured JSON logging.

**Current implementation:** The worker is a lifecycle bootstrap.
It remains active, supports SIGINT/SIGTERM shutdown, and does
not process jobs yet.

BullMQ job processing, retries, and durable execution will be
introduced in M3.

The temporary bootstrap heartbeat will be removed when the
BullMQ worker lifecycle is implemented.

To run the compiled worker:

```bash
npm run build
npm run start:worker
```

Stop the worker using Ctrl+C.

### Quality Checks

```bash
npm run check
```

The quality pipeline runs formatting validation, linting,
TypeScript type checking, Jest tests, and the production build.

### Current Implementation Scope

- Modular TypeScript architecture
- Validated application configuration
- Express API bootstrap
- Pino structured logging
- HTTP liveness endpoint
- PostgreSQL and Redis local infrastructure
- Automated quality checks and GitHub Actions CI

Durable jobs, LangGraph execution, human approval, publishing,
and complete observability will be introduced in subsequent milestones.
