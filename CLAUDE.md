# NodeMap — Project Context

NodeMap is a **Codebase Intelligence Platform** — a full-stack web app that turns any repository into deterministic architecture intelligence (dependency graph, endpoint flows, risk map, impact analysis, dead-code candidates, reports) with **optional** AI explanations on top.

## Current Status: Codebase Intelligence Platform refactor complete (2026-05-25)

### Product surface (10 pages, sidebar-based)

| Route | Page | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Health ring, stat grid, top risk/connected, endpoint method mix, repo list |
| `/repo-graph` | RepoGraphPage | Existing folder/file React Flow tree (custom top-down layout) |
| `/dependency-graph` | DependencyGraphPage | Layered file→file graph coloured by architecture layer + side panel |
| `/endpoint-map` | EndpointMapPage | Dropdown of detected HTTP endpoints → step-by-step flow diagram |
| `/risk-map` | RiskMapPage | Risk-ranked files with reasons + impact panel + AI explain |
| `/pr-impact` | PRImpactPage | Manual changed-files → blast-radius analysis (GitHub OAuth pending) |
| `/dead-code` | DeadCodePage | Confidence-graded candidates with false-positive caveats |
| `/ai-explainer` | AIExplainerPage | Repo brief + per-file explain (provider-pluggable) |
| `/reports` | ReportsPage | Markdown / JSON export with section picker |
| `/settings` | SettingsPage | AI provider, API key, model, test-connection, ignored paths |

---

## Analysis Pipeline (deterministic, no AI required)

```
ingestion → astParser → dependencyResolver → symbolParser → DB
                                                         │
                                                         ▼
                                               analysis/repoAnalysis.ts
                                          ┌─────────┬──────┬──────┬────────┐
                                          ▼         ▼      ▼      ▼        ▼
                                    endpoints    risk   impact  dead   layers
                                                                       code
```

All pages consume one cached `RepoAnalysis` envelope (in `analysis_results` table,
type `analysis_v1`, invalidated on every re-ingestion).

### Backend folders (post-refactor)

```
apps/api/src/
 ├── routes/        repositories, upload, fromUrl, graph, ai, analysis, reports, settings
 ├── services/      ingestion, astParser, symbolParser, dependencyResolver, graphBuilder, repoDownload
 ├── analysis/      endpoints/, layers/, risk/, impact/, deadcode/, dependencies/, reports/, repoAnalysis.ts, analysisCache.ts
 ├── ai/            providers/{OpenAI,Gemini,AIProvider}.ts, aiService.ts
 ├── storage/       db.ts, schema.ts, settingsStore.ts
 ├── utils/         id, loadEnv, pathSecurity
 └── types/         row types
```

### AI provider abstraction

`AIProvider` interface with three impls — `OpenAIProvider`, `GeminiProvider`,
`DisabledProvider`. Selected via `app_settings.ai.provider` (DB-persisted). Falls
back to env `OPENAI_API_KEY` / `GEMINI_API_KEY` if not set in DB. AI is **only**
used by the Explainer page and the "Explain with AI" button on the Risk Map.

### Endpoint detection

Regex-based for Express/Fastify/Koa/Hapi/NestJS. Detects:
- `app/router/server.get|post|put|patch|delete('path', handler)`
- Fastify `app.route({ method, url, handler })`
- Hapi `server.route({ method, path, handler })`
- NestJS `@Get/@Post/@Put/@Patch/@Delete(path)`

Walks the dependency graph (BFS depth 4) from the route file to populate
`controllerFile`, `serviceChain`, `repositoryChain`, `middleware` automatically
using path heuristics (controller/service/repo/middleware folder + filename
patterns).

### Risk scoring (deterministic)

```
score = incomingDeps*3 + outgoingDeps*2 + affectedEndpoints*5
      + (inCircular ? 25 : 0)
      + sizePenalty(lineCount)           // 0–20 by tier
      + complexityPenalty(fns + classes) // 0–15 by tier
      + round(centrality * 20)           // depth-2 transitive importedBy / total
```

Capped at 100. Levels: `critical >= 80, high >= 60, medium >= 35, low otherwise`.

### Impact analysis

Pure reverse BFS over `target -> source` adjacency. Single-file and multi-file
variants (multi for PR Impact). Affected endpoints = any endpoint whose
route/controller/service/repository chain intersects the impacted set.

### Dead code

A file is a *candidate* only if: no incoming imports AND not entry-point AND
not framework config AND not under `public/static/assets/` AND not in any
endpoint chain. Confidence is downgraded for Storybook, type-only files,
migrations, tests, underscore-prefixed files.

---

## Graph Architecture (existing folder/file view — RepoGraph page)

**Layout engine:** Custom top-down tree — no dagre. Implemented in `GraphCanvas.tsx`.
- Root folders sit in a **single horizontal row** at the top of the canvas.
- Expanding a folder reveals its **direct children** (files and sub-folders) in **one horizontal row** below it, each centred over its own subtree.
- `subtreeW(id)` — recursively measures the full horizontal span a subtree needs; guarantees siblings never overlap at any depth.
- `placeNode(id, cx, y)` — places node centred at `cx`, then fans children below it using `subtreeW` to divide horizontal space.
- Layout constants: `NODE_W=220`, `NODE_H=64`, `LEVEL_GAP_Y=80` (parent bottom → children top), `SIBLING_GAP_X=32` (gap between sibling subtrees), `ROOT_GAP_X=48`.

**Folder modes:**
- **Collapsed** — renders as `FolderNode` (compact card with chevron + child count). Clicking toggles expansion.
- **Expanded** — the folder node stays in place; its direct children (files as `FileNode`, sub-folders as `FolderNode`) appear below connected by smoothstep tree edges.
- Both `type === 'folder'` and `type === 'group'` are treated as folders (expand/collapse behaviour, not selectable as files).

**Node ordering:** `allVisible` is built by filtering `graphNodes` (the server-ordered list) through a Set of visible IDs — expanded folders stay in their original position, never shuffled to the end.

**Viewport rules:**
- `setViewport({ x:40, y:40, zoom:0.85 })` once on initial graph load — no auto fit.
- Expanding/collapsing nodes → viewport is **never touched**. User pans freely.
- `fitView` is only triggered by the manual **Fit to Screen** button in `GraphControls`.

**Edge types:**
- **Tree edges** — `smoothstep`, `rgba(99,102,241,0.35)`, 1.5px — show the folder hierarchy (parent → child).
- **Import edges** — `smoothstep`, coloured by type (indigo/green/purple/red), thickness scales with `importedByCount`. Filtered by edge type chips in the toolbar.
- **Aggregated import edges** — if source/target is inside a collapsed folder, the folder node is substituted as the endpoint.

**Significance encoding:**
- Node glow (green) intensity = `importedByCount` (how many files depend on this one)
- Edge thickness = target node's `importedByCount`
- Dead code nodes = faded (`opacity-35`)
- Circular dep edges = red + animated

**Analysis panels (left sidebar):**
- `Cycles` tab — circular dependency cycles grouped by union-find
- `Dead` tab — unreferenced files
- `Stats` tab — overview + risk distribution + languages + most-imported

**Node detail panel (right sidebar):**
- Opens on file click
- Shows metrics, impact analysis (transitive dependents), circular deps, imports, importedBy, functions, classes
- Sections are collapsible

**Graph controls (bottom-right):**
- `GraphControls` component rendered inside `<Panel>` so `useReactFlow()` works.
- Buttons: Zoom In, Zoom Out, Fit to Screen, Center Selected Node, Reset View.

---

## UI Design System

**Theme:** Terminal/Hacker — OLED black (#050505 bg), electric green (#00ff87) primary, JetBrains Mono for data
**Key CSS vars:** `--background: 0 0% 2%`, `--primary: 152 100% 50%`, `--radius: 0.25rem` (sharp corners)
**Scanline effect:** `body::after` with repeating-linear-gradient at 1.2% opacity
**Animations:** `animate-cursor-blink` (navbar cursor), `animate-fade-in`, `pulse-glow`

---

## Tech Stack

```
apps/
  web/    React 18, Vite, TypeScript, Tailwind v3 (dark), React Flow v12, Zustand, TanStack Query, React Router v6
  api/    Fastify v4, TypeScript, tsx (dev), tsup (build), Zod, nanoid, pino-pretty
packages/
  types/  Shared TypeScript interfaces (Repository, GraphData, IngestionResult, etc.)
  shared/ Utility functions (formatBytes, getRiskLevel, getLanguageColor, SUPPORTED_EXTENSIONS)
```

**Storage:** sql.js (WASM SQLite) — chosen because Windows machine lacks VS Build Tools for better-sqlite3/node-gyp. Manual persistence after every write via `.export()`.

**Key constants:**
- API runs on port 3001
- Frontend dev server on port 5173
- DB file: `apps/api/data/nodemap.db`
- Extracted repo files: `apps/api/uploads/{repoId}/`
- Temp ZIPs: `apps/api/temp/{repoId}.zip` (deleted after ingestion)

---

## Key Architecture Decisions

1. **sql.js over better-sqlite3** — no native compilation needed on Windows
2. **`dbTransaction()` + `dbRunBatch()`** — all file + dependency inserts in one transaction = one disk write. Never use `dbRun()` inside a loop.
3. **Regex-based import parser** (not ts-morph) — fast, no native deps, handles 95%+ of cases. File: `apps/api/src/services/astParser.ts`
4. **Regex-based symbol parser** — same philosophy as import parser. Extracts functions + classes per file. File: `apps/api/src/services/symbolParser.ts`
5. **Pre-generate file IDs** before the DB transaction so dependency rows can reference them
6. **Symbols stored as JSON in `files.symbols` column** — added via migration on startup. Default `{}` for old rows.
7. **Graph is stateless on the server** — rebuilt fresh on every `/graph` request from DB rows. No graph stored in DB.
8. **Custom tree layout, no dagre** — `subtreeW` + `placeNode` in `GraphCanvas.tsx`. Top-down tree: roots in a horizontal row, children fan out below. Guarantees zero overlap without a graph library.
9. **Aggregated import edges for collapsed folders** — computed client-side. If source/target is inside a collapsed folder, the folder node is substituted as the edge endpoint (`findVisibleId` walks up the parentMap).
10. **`allVisible` preserves server order** — built by filtering `graphNodes` through a Set; never re-sorted by type. This keeps folders in their original position when expanded.
11. **Folder type detection includes `group`** — `folderGraphNodes` collects nodes where `type === 'folder' || type === 'group'`; both get expand/collapse behaviour.
12. **No auto-viewport on expand/collapse** — `setViewport` called once on initial load only. All subsequent expand/collapse events leave the viewport untouched. `fitView` only via the manual button.
13. **`FolderBgNode` kept in NODE_TYPES but never generated** — left as a safe no-op; the current layout does not render background regions.
14. **graphStore.graphData** — set via `setGraphData()` in GraphExplorerPage when graph loads. Required for NodeDetailPanel impact analysis, AnalysisPanel panels, and `selectNode()` to resolve the full node object.

---

## New API surface

| Endpoint | Purpose |
|---|---|
| `GET  /api/repositories/:id/analysis` | Unified `RepoAnalysis` (cached, `?refresh=true` to rebuild) |
| `GET  /api/repositories/:id/endpoint-flow?endpointId=…` | Step-by-step flow for one endpoint |
| `GET  /api/repositories/:id/impact?fileId=…` | Direct + indirect dependents + affected endpoints |
| `POST /api/repositories/:id/pr-impact` | `{ changedFiles: string[] }` → blast radius |
| `POST /api/repositories/:id/report` | `{ format, sections }` → Markdown or JSON download |
| `POST /api/repositories/:id/analysis/invalidate` | Drop the analysis cache (auto-called on re-ingest) |
| `GET  /api/settings` | App settings (AI provider, ignored paths, GitHub, graph) |
| `PUT  /api/settings` | Update settings |
| `POST /api/settings/ai/test` | Ping the configured AI provider |
| `GET  /api/ai/status` | Provider id + configured boolean (global, no repoId) |
| `GET  /api/repositories/:id/ai/brief` | Architecture brief (cached) |
| `POST /api/repositories/:id/ai/explain` | `{ nodeId }` → per-file explanation (cached) |

---

## File Map (key files only)

### API — analysis & AI
| File | Purpose |
|---|---|
| `apps/api/src/index.ts` | Fastify bootstrap, registers all routes under `/api` |
| `apps/api/src/storage/db.ts` | sql.js init + migrations + helpers (typed `SqlValue`) |
| `apps/api/src/storage/schema.ts` | Tables + `MIGRATIONS[]` (adds `app_settings`, `analysis_results` etc.) |
| `apps/api/src/storage/settingsStore.ts` | Persistent settings: AI provider/key/model, ignored paths, GitHub token |
| `apps/api/src/services/ingestion.ts` | Extract ZIP → walk → parse imports + symbols → DB → **invalidate analysis cache** |
| `apps/api/src/services/astParser.ts` | Regex import extractor |
| `apps/api/src/services/symbolParser.ts` | Regex symbol extractor |
| `apps/api/src/services/dependencyResolver.ts` | Resolve relative imports |
| `apps/api/src/services/graphBuilder.ts` | Builds the folder/file graph for Repo Graph page |
| `apps/api/src/analysis/repoAnalysis.ts` | **Unified RepoAnalysis builder** — single source of truth |
| `apps/api/src/analysis/analysisCache.ts` | `getOrBuildAnalysis(repoId)`, `invalidateAnalysis(repoId)` |
| `apps/api/src/analysis/endpoints/endpointDetector.ts` | Express/Fastify/Koa/Hapi/Nest endpoint detection + chain inference |
| `apps/api/src/analysis/endpoints/endpointFlow.ts` | Builds step-by-step flow for a single endpoint |
| `apps/api/src/analysis/layers/layerClassifier.ts` | Path-based architecture-layer assignment |
| `apps/api/src/analysis/dependencies/circular.ts` | Tarjan SCC for circular dep groups |
| `apps/api/src/analysis/risk/riskEngine.ts` | Deterministic risk score + reasons |
| `apps/api/src/analysis/impact/impactEngine.ts` | Reverse-BFS impact (single + multi file) |
| `apps/api/src/analysis/deadcode/deadCodeEngine.ts` | Dead-code candidate detection with confidence |
| `apps/api/src/analysis/reports/reportGenerator.ts` | Markdown + JSON report generator |
| `apps/api/src/ai/providers/AIProvider.ts` | Interface + DisabledProvider |
| `apps/api/src/ai/providers/OpenAIProvider.ts` | OpenAI Chat Completions |
| `apps/api/src/ai/providers/GeminiProvider.ts` | Google Gemini |
| `apps/api/src/ai/aiService.ts` | Provider-aware `generateRepoBrief` / `explainNode` with caching |
| `apps/api/src/routes/repositories.ts` | CRUD + re-scan |
| `apps/api/src/routes/upload.ts` · `fromUrl.ts` | Ingestion entry points |
| `apps/api/src/routes/graph.ts` | Folder/file React-Flow graph |
| `apps/api/src/routes/ai.ts` | `/ai/status`, `/ai/brief`, `/ai/explain` |
| `apps/api/src/routes/analysis.ts` | `/analysis`, `/endpoint-flow`, `/impact`, `/pr-impact`, `/analysis/invalidate` |
| `apps/api/src/routes/reports.ts` | `/report` download |
| `apps/api/src/routes/settings.ts` | `/settings` GET/PUT + AI connection test |

### Web — pages & layout
| File | Purpose |
|---|---|
| `apps/web/src/App.tsx` | All 10 pages registered as routes under `<AppLayout>` |
| `apps/web/src/api/client.ts` | repoApi, fromUrlApi, graphApi, aiApi, **analysisApi**, **reportsApi**, **settingsApi** |
| `apps/web/src/components/layout/AppLayout.tsx` | Sidebar + RepoSelector + `<Outlet>` |
| `apps/web/src/components/layout/Sidebar.tsx` | 10-section sidebar nav (disables repo-required pages when no repo) |
| `apps/web/src/components/layout/RepoSelector.tsx` | Persistent active-repo dropdown in the top bar |
| `apps/web/src/components/layout/PageShell.tsx` | `<PageShell>` + `NoRepoState` + `PageLoading` + `PageError` helpers |
| `apps/web/src/store/activeRepoStore.ts` | Zustand `persist` for active repoId (shared across pages) |
| `apps/web/src/hooks/useAnalysis.ts` | `useAnalysis(repoId)` — every page consumes this |
| `apps/web/src/pages/DashboardPage.tsx` | Health ring, stat cards, top files, method bar, repo list |
| `apps/web/src/pages/RepoGraphPage.tsx` | Existing GraphCanvas under the new shell |
| `apps/web/src/pages/DependencyGraphPage.tsx` | Layered DependencyGraphCanvas + impact side panel |
| `apps/web/src/pages/EndpointMapPage.tsx` | Endpoint list + step-by-step flow diagram |
| `apps/web/src/pages/RiskMapPage.tsx` | Risk list + reasons + impact + "Explain with AI" button |
| `apps/web/src/pages/PRImpactPage.tsx` | Manual changed-files → blast-radius report |
| `apps/web/src/pages/DeadCodePage.tsx` | Confidence-filtered candidate list |
| `apps/web/src/pages/AIExplainerPage.tsx` | Repo brief + per-file explain |
| `apps/web/src/pages/ReportsPage.tsx` | Markdown/JSON report download |
| `apps/web/src/pages/SettingsPage.tsx` | AI provider, key, model, test, ignored paths |
| `apps/web/src/pages/GraphExplorerPage.tsx` | Legacy `/graph/:id` direct route (still works) |
| `apps/web/src/pages/UploadPage.tsx` | URL/ZIP ingestion screen (now sets `activeRepo` on completion) |
| `apps/web/src/components/graph/DependencyGraphCanvas.tsx` | Layer-coloured layered graph (separate from RepoGraph) |
| `apps/web/src/components/graph/GraphCanvas.tsx` | React Flow canvas, custom top-down tree layout (`subtreeW`/`placeNode`), expansion logic, aggregated import edges, tree edges, keyboard shortcuts, context menu, edge filters, minimap risk coloring, GraphControls panel |
| `apps/web/src/components/graph/GraphToolbar.tsx` | Mode buttons, analysis panel toggles, edge type filter chips, search input |
| `apps/web/src/components/graph/GraphLegend.tsx` | Node type + risk legend (shifts right when analysis panel is open) |
| `apps/web/src/components/graph/AnalysisPanel.tsx` | Left sidebar with Cycles/Dead/Stats tabs |
| `apps/web/src/components/graph/panels/CircularDepsPanel.tsx` | Circular dependency cycle list |
| `apps/web/src/components/graph/panels/DeadCodePanel.tsx` | Unreferenced file list |
| `apps/web/src/components/graph/panels/StatsPanel.tsx` | Repo stats: overview + risk + languages + most-imported |
| `apps/web/src/components/graph/NodeDetailPanel.tsx` | Side panel: path, language, risk, impact analysis, circular, imports/importedBy, functions, classes |
| `apps/web/src/components/graph/ContextMenu.tsx` | Right-click menu: copy path, open GitHub, show impact |
| `apps/web/src/components/graph/SearchDropdown.tsx` | Search results dropdown with jump-to-node |
| `apps/web/src/components/graph/FilterBar.tsx` | Risk/language/type filter chips |
| `apps/web/src/components/graph/nodes/FileNode.tsx` | File node with glow by importedBy count, dead code fading |
| `apps/web/src/components/graph/nodes/FolderNode.tsx` | Collapsed folder node (reads expansion state from Zustand) |
| `apps/web/src/components/graph/GraphControls.tsx` | Zoom In/Out, Fit to Screen, Center Selected, Reset View — rendered inside `<Panel>` so `useReactFlow()` works |
| `apps/web/src/components/graph/nodes/FolderBgNode.tsx` | Expanded folder background region — kept in NODE_TYPES but not currently rendered |
| `apps/web/src/components/graph/nodes/ServiceNode.tsx` | Service/route node |
| `apps/web/src/components/graph/nodes/ModuleNode.tsx` | External module node |
| `apps/web/src/components/ErrorBoundary.tsx` | React error boundary wrapping graph and panels |
| `apps/web/src/components/graph/OnboardingOverlay.tsx` | First-time user guide overlay |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcuts: Escape, /, F, Cmd+K |
| `apps/web/src/store/graphStore.ts` | Zustand: selectedNodeId, expandedNodes, highlightedNodes, mode, activePanel, edgeFilters, graphData |

---

## Dev Commands

```bash
# Start both servers (note: concurrently's sub-pnpm doesn't work on Windows)
# Run each separately:
pnpm --filter @nodemap/api dev      # port 3001
pnpm --filter @nodemap/web dev      # port 5173

# Build
pnpm --filter @nodemap/api build
pnpm --filter @nodemap/web build
```

---

## Known Issues / Gotchas

- **`pnpm dev` (root) fails on Windows** — `concurrently` spawns pnpm in a subprocess that isn't on PATH. Run each app separately instead.
- Symbol extraction is regex-based — misses decorators, complex generics, multi-line arrow functions. Good enough for 95% of cases.
- Existing ingested repos won't have symbols (the `symbols` column defaults to `{}`). Must re-ingest to get function/class data.
- Graph re-layouts on every folder expand/collapse (custom tree algorithm runs fresh each time) — smooth CSS transitions on `.react-flow__node` mitigate the visual jump.
- Re-scan endpoint returns 501 until a `reingestFromDirectory` function is implemented in ingestion.ts.
- GitHub deep links require the repo to have been ingested from a URL (description field contains "Github: owner/repo"). ZIP-uploaded repos won't have GitHub links.
- `source_url` column added via migration — existing repos won't have it until re-ingested from URL.
