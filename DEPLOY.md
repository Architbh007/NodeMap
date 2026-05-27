# NodeMap — Deployment Guide

NodeMap is a single Docker image that serves the Vite frontend **and** the Fastify API from the same process on port 3001.

---

## What the image does

| Stage | What happens |
|---|---|
| **Stage 1** (web-builder) | `pnpm --filter @nodemap/web build` → Vite output in `apps/web/dist/` |
| **Stage 2** (api-builder) | `pnpm --filter @nodemap/api build` → tsup bundle in `apps/api/dist/` + `sql-wasm.wasm` copied beside it; `pnpm deploy` prunes to prod deps |
| **Stage 3** (production) | Final `node:20-alpine` image, `node dist/index.js`, serves `/public` as static files |

Persistent data lives in two volumes: `nodemap-data` (SQLite DB) and `nodemap-uploads` (extracted repos).

---

## Option A — Docker Compose (simplest, any VPS)

```bash
# 1. Clone and enter the project
git clone <your-repo-url> nodemap && cd nodemap

# 2. Create your env file
cp .env.example .env
# Edit .env — add at least one AI key (OPENAI_API_KEY or GEMINI_API_KEY)

# 3. Build and start
docker compose up -d --build

# App is now at http://localhost:3001
```

To update later:

```bash
git pull
docker compose up -d --build
```

---

## Option B — Railway (no Docker knowledge needed)

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Railway auto-detects the `Dockerfile` at the root.
4. In **Variables**, add:
   - `OPENAI_API_KEY` or `GEMINI_API_KEY`
   - `PORT` = `3001` (Railway sets this automatically, but set it explicitly to be safe)
5. In **Settings → Volumes**, create a volume mounted at `/app/data` (for the database) and one at `/app/uploads`.
6. Deploy. Railway gives you a public HTTPS URL.

---

## Option C — Render

1. Push repo to GitHub.
2. [render.com](https://render.com) → **New Web Service** → connect repo.
3. Set:
   - **Environment**: Docker
   - **Dockerfile path**: `./Dockerfile`
   - **Port**: `3001`
4. Add env vars (`OPENAI_API_KEY`, etc.).
5. Add a **Disk** in the Render dashboard:
   - Mount path: `/app/data`
   - 1 GB is plenty for the SQLite DB
   - Add a second disk for `/app/uploads` if you want uploads to survive redeploys.
6. Deploy.

> **Note:** Render's free tier sleeps after 15 min of inactivity. Use the Starter plan ($7/mo) for always-on.

---

## Option D — Fly.io

```bash
# Install flyctl and log in
brew install flyctl && fly auth login

# Inside the project root:
fly launch --name nodemap --dockerfile Dockerfile --no-deploy
# Accept defaults, pick a region close to you

# Add env vars
fly secrets set OPENAI_API_KEY=sk-...

# Create persistent volumes
fly volumes create nodemap_data    --size 1 --region <your-region>
fly volumes create nodemap_uploads --size 5 --region <your-region>
```

Edit the generated `fly.toml` to mount the volumes:

```toml
[[mounts]]
  source      = "nodemap_data"
  destination = "/app/data"

[[mounts]]
  source      = "nodemap_uploads"
  destination = "/app/uploads"
```

```bash
fly deploy
```

---

## Environment variables reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port the server listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `production` | Must be `production` to enable static file serving |
| `OPENAI_API_KEY` | — | For OpenAI provider (GPT-4o-mini default) |
| `GEMINI_API_KEY` | — | For Google Gemini provider |
| `DATA_DIR` | `<cwd>/data` | Absolute path for the SQLite database |
| `UPLOADS_DIR` | `<cwd>/uploads` | Absolute path for uploaded/extracted repos |
| `STATIC_DIR` | `<cwd>/public` | Absolute path for the built Vite frontend |

---

## Local production test (without Docker)

```bash
# Build everything
pnpm build

# Copy the Vite output where the API can find it
cp -r apps/web/dist apps/api/public

# Copy sql.js WASM alongside the bundle
cp node_modules/.pnpm/sql.js*/node_modules/sql.js/dist/sql-wasm.wasm apps/api/dist/

# Run
cd apps/api
NODE_ENV=production node dist/index.js
# → open http://localhost:3001
```

---

## Health check

```
GET /api/health
→ { "status": "ok", "uptime": 123 }
```

Used by Docker's `HEALTHCHECK`, Railway, Render, and Fly.io to know when the container is ready.
