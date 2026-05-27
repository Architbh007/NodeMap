# NodeMap

**NodeMap turns any codebase into an interactive architecture map.** Drop in a GitHub URL or a ZIP and get a full picture of your repo in seconds — dependency graphs, risk scoring, endpoint flows, dead code detection, PR impact analysis, and optional AI explanations. No account required. Runs entirely on your machine.

![NodeMap Dashboard](https://raw.githubusercontent.com/Architbh007/nodemap/main/docs/screenshot.png)

---

## What you get

| Page | What it shows |
|---|---|
| **Dashboard** | Health score, KPI grid, top-risk files, HTTP method mix, repo list |
| **Repo Graph** | Expandable folder/file tree — click any folder to drill in |
| **Dependency Graph** | File-to-file imports coloured by architecture layer (route → controller → service → repo) |
| **Endpoint Map** | Every detected HTTP endpoint with its full request chain visualised step by step |
| **Risk Map** | Files ranked by a deterministic risk score with reasons; "Explain with AI" button |
| **PR Impact** | Paste a PR URL or a list of changed files → see every file and endpoint affected |
| **Dead Code** | Unreferenced file candidates with confidence levels and false-positive caveats |
| **Tunner AI** | Optional per-file AI explanations and repo-wide architecture briefs |
| **Reports** | Export the full analysis as Markdown or JSON |
| **Settings** | AI provider, API key, ignored paths, GitHub token |

### How the analysis works

Everything except the AI explanations is **100% deterministic static analysis** — no AI, no internet, no magic:

```
Upload / URL
     │
     ▼
  Extract → walk files → regex import parser → symbol extractor
                                      │
                                      ▼
                               SQLite (sql.js)
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
              Endpoint           Risk engine        Dead code
              detector           (score 0–100)      (reverse BFS)
                    │                 │                  │
                    └─────────────────┴──────────────────┘
                                      │
                                      ▼
                               10 UI pages
```

Supported languages: TypeScript, JavaScript, Python, Rust, Go, Java, Kotlin, C#, C/C++, Ruby, PHP, Swift and more.

---

## Prerequisites

- **Node.js 20+**
- **pnpm** — `npm install -g pnpm`

No database setup, no Docker, no environment variables required to get started.

---

## Getting started

```bash
# 1. Clone
git clone https://github.com/Architbh007/nodemap.git
cd nodemap

# 2. Install dependencies
pnpm install

# 3. Start the API (port 3001)
pnpm --filter @nodemap/api dev

# 4. In a second terminal — start the frontend (port 5173)
pnpm --filter @nodemap/web dev
```

Open **http://localhost:5173** and click **New Analysis** to upload your first repository.

> **Windows note:** `pnpm dev` at the root uses `concurrently`, which doesn't work reliably on Windows. Run the two `--filter` commands in separate terminals instead.

---

## Analyzing a repository

**From a GitHub URL**
1. Click **New Analysis** in the sidebar
2. Paste any public GitHub URL — `https://github.com/owner/repo`
3. NodeMap downloads the archive, scans it, and redirects you to the Dashboard

**From a ZIP file**
1. Click **New Analysis**
2. Switch to **Upload ZIP**
3. Drop a `.zip` of your repo (max 100 MB)

Private repos are supported — add a Personal Access Token in **Settings → GitHub Integration**.

---

## Optional: AI explanations (Tunner)

The AI features are entirely optional. The full analysis works without any API key.

To enable:
1. Go to **Settings → AI Provider**
2. Choose **OpenAI** or **Gemini**
3. Paste your API key
4. Hit **Test connection**

The key is stored locally in the SQLite database on your machine and is never sent anywhere except to the AI provider when you request an explanation. The `GET /api/settings` endpoint only returns `apiKeySet: true/false` — the raw key is never exposed over the network.

Recommended models: `gpt-4o-mini` (fast, cheap) or `gemini-2.0-flash`.

---

## Project structure

```
nodemap/
├── apps/
│   ├── api/                  Fastify backend (port 3001)
│   │   └── src/
│   │       ├── routes/       HTTP route handlers
│   │       ├── services/     Ingestion, AST parsing, graph building
│   │       ├── analysis/     Endpoints, risk, impact, dead code, reports
│   │       ├── ai/           OpenAI + Gemini providers
│   │       └── storage/      sql.js DB, schema, settings store
│   └── web/                  React 18 frontend (port 5173)
│       └── src/
│           ├── pages/        One file per route
│           ├── components/   Layout, graph canvas, UI primitives
│           ├── hooks/        Data-fetching hooks
│           └── store/        Zustand stores (active repo, graph state)
├── packages/
│   ├── types/                Shared TypeScript interfaces
│   └── shared/               Shared utilities (formatBytes, getRiskLevel, …)
└── pnpm-workspace.yaml
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v3 |
| Graph | @xyflow/react (React Flow v12), custom tree layout |
| State | Zustand, TanStack Query |
| Backend | Fastify v4, TypeScript, Zod |
| Database | sql.js (WASM SQLite — no native compilation needed) |
| AI | OpenAI Chat Completions · Google Gemini (both optional) |
| Monorepo | pnpm workspaces |

**Why sql.js instead of better-sqlite3?**
sql.js is a WASM build of SQLite that requires zero native compilation. This means `pnpm install` works out of the box on Windows without Visual Studio Build Tools. The tradeoff is that the entire DB is held in memory and flushed to disk after every write — fine for the repo sizes NodeMap analyses.

---

## All dev commands

```bash
# Run API in dev mode (tsx watch, auto-restarts)
pnpm --filter @nodemap/api dev

# Run frontend in dev mode (Vite HMR)
pnpm --filter @nodemap/web dev

# Type-check everything
pnpm --recursive type-check

# Production build (types → shared → web → api)
pnpm build
```

---

## API reference

```
GET    /api/health
GET    /api/repositories
POST   /api/repositories/:id/upload          ZIP upload
POST   /api/repositories/from-url            GitHub URL ingestion
GET    /api/repositories/:id/analysis        Full RepoAnalysis (cached)
GET    /api/repositories/:id/graph           Folder/file React Flow graph
GET    /api/repositories/:id/endpoint-flow   Step-by-step flow for one endpoint
GET    /api/repositories/:id/impact          Blast radius for one file
POST   /api/repositories/:id/pr-impact       Blast radius for a list of files
POST   /api/repositories/:id/report          Download Markdown or JSON report
GET    /api/settings
PUT    /api/settings
POST   /api/settings/ai/test
POST   /api/settings/github/test
GET    /api/ai/status
POST   /api/repositories/:id/ai/brief        AI architecture brief (cached)
POST   /api/repositories/:id/ai/explain      AI per-file explanation (cached)
```

---

## Contributing

PRs are welcome. A few things to know before diving in:

- The API is a single Fastify process with a WASM SQLite DB — no migrations beyond the `MIGRATIONS[]` array in `schema.ts`
- The import/symbol parsers are regex-based (`astParser.ts`, `symbolParser.ts`) — deliberate choice for speed and zero native deps
- The graph layout is a custom top-down tree in `GraphCanvas.tsx` — no dagre
- All analysis results are cached in `analysis_results` and invalidated on every re-ingestion

```bash
# After making changes, make sure these both pass before opening a PR
pnpm --recursive type-check
pnpm --filter @nodemap/web build
```

---

## License

MIT
