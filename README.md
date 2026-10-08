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
