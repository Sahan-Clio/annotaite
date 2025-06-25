# annot-ai-tor

Rails 7 API + React 18 monorepo for AI-powered annotation.

## Quick Start

```bash
git clone <repo-url> annot-ai-tor && cd annot-ai-tor
cp .env.example .env && cp server/.env.example server/.env && cp client/.env.example client/.env.local
dev up
```

- **React UI**: http://localhost:5173

## Stack

- **Backend**: Rails 7 API + MySQL 8
- **Frontend**: React 18 + Vite + TypeScript + React Query
- **Dev**: Docker Compose + dev.yml commands

## Commands

```bash
dev up              # Start all services
dev down            # Stop all services
dev api.console     # Rails console
dev db.shell        # MySQL shell
```

## Structure

```
server/             # Rails API
client/             # React app
docker-compose.yml  # All services
.cursor/rules/      # Cursor AI coding standards
```

## Cursor Rules

- **`.cursor/rules/rails_backend.mdc`** - Rails API best practices
- **`.cursor/rules/react_frontend.mdc`** - React/TypeScript frontend standards