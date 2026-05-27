# ─── Stage 1: Build frontend (Vite) ──────────────────────────────────────────
FROM node:20-alpine AS web-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests (layer-cache friendly)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json    ./packages/types/
COPY packages/shared/package.json   ./packages/shared/
COPY apps/web/package.json          ./apps/web/
COPY apps/api/package.json          ./apps/api/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/ ./packages/
COPY apps/web/  ./apps/web/

RUN pnpm --filter @nodemap/web build
# → output: apps/web/dist/


# ─── Stage 2: Build API (tsup) ───────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json    ./packages/types/
COPY packages/shared/package.json   ./packages/shared/
COPY apps/api/package.json          ./apps/api/
COPY apps/web/package.json          ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/api/  ./apps/api/

# Build the API bundle
RUN pnpm --filter @nodemap/api build

# sql.js loads its WASM from a path relative to import.meta.url inside the bundle.
# After tsup bundles everything to dist/index.js, the WASM must live beside it.
# Use find so the path works regardless of where pnpm hoists sql.js.
RUN find /app -path "*/sql.js/dist/sql-wasm.wasm" ! -name "*browser*" | head -1 \
    | xargs -I{} cp {} apps/api/dist/

# Create a self-contained production deployment (prod deps only, no devDeps)
RUN pnpm --filter @nodemap/api --prod deploy /prod-api


# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy the pruned production dependency tree + package.json
COPY --from=api-builder /prod-api ./

# Overwrite/add the compiled API bundle (pnpm deploy may not copy apps/api/dist)
COPY --from=api-builder /app/apps/api/dist ./dist

# Serve the Vite build as static files at /app/public
COPY --from=web-builder /app/apps/web/dist ./public

# Persistent directories — mount these as Docker volumes
RUN mkdir -p data uploads

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
