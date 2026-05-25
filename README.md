# NodeMap

> **Google Maps for your codebase.** An interactive architecture intelligence platform that transforms repositories into explorable dependency graphs.

## What it does

Upload a repository ZIP and get:
- Interactive expandable architecture map
- File-to-file dependency graph with risk scores
- Circular dependency detection (animated red edges)
- API flow tracing (Route → Controller → Service → Repository)
- Dead code detection
- Impact analysis

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Graph | @xyflow/react (React Flow v12), dagre layout |
| UI | shadcn/ui, Zustand, TanStack Query |
| API | Fastify v4, TypeScript, tsx |
| Storage | sql.js (WASM SQLite — no native deps) |
| Monorepo | pnpm workspaces |

## Project Structure

```
nodemap/
├── apps/
│   ├── web/          # React frontend (port 5173)
│   └── api/          # Fastify backend (port 3001)
├── packages/
│   ├── types/        # Shared TypeScript interfaces
│   └── shared/       # Shared utility functions
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

**Prerequisites:** Node.js 20+, pnpm

```bash
# Install dependencies
pnpm install

# Start both servers in parallel
pnpm dev

# Web → http://localhost:5173
# API → http://localhost:3001/api/health
```

## Development

```bash
# Start only the API
pnpm --filter @nodemap/api dev

# Start only the web app
pnpm --filter @nodemap/web dev

# Type-check all packages
pnpm type-check

# Build everything
pnpm build
```

## API Endpoints

```
GET  /api/health                    Health check
GET  /api/repositories              List all repositories
POST /api/repositories              Create repository
GET  /api/repositories/:id          Get repository
DELETE /api/repositories/:id        Delete repository
PATCH /api/repositories/:id/status  Update status
```

## Build Phases

- [x] **Phase 1** — Monorepo setup, API skeleton, 4 UI pages, React Flow graph
- [ ] **Phase 2** — ZIP upload + extraction, file scanner
- [ ] **Phase 3** — File system scanner (TS/JS/JSON)
- [ ] **Phase 4** — AST parsing with ts-morph
- [ ] **Phase 5** — Dependency resolution
- [ ] **Phase 6** — Graph builder
- [ ] **Phase 7** — Expandable graph UI
- [ ] **Phase 8** — Graph modes (folder, deps, API flow, risk, impact)
- [ ] **Phase 9** — Circular dependency detection
- [ ] **Phase 10** — Dead code 

- [ ] **Phase 11** — Impact analysis
- [ ] **Phase 12** — API flow mapping
- [ ] **Phase 13** — Intelligence dashboard
- [ ] **Phase 14** — Search system
- [ ] **Phase 15** — Export system


## Notes

- The API uses `sql.js` (WASM SQLite) instead of `better-sqlite3` to avoid requiring Visual Studio Build Tools on Windows. To switch to `better-sqlite3` for better performance: install VS Build Tools, swap the dependency in `apps/api/package.json`, and update `apps/api/src/storage/db.ts`.
- In Phase 1 the Graph Explorer shows a demo graph. Real graph data comes in Phase 4–6.
