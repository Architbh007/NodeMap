# NodeMap — Progress Tracker

Last updated: 2026-05-25 (Tunner rebrand, graph layouts, OpenAI settings)

---

## What NodeMap Is

Upload or link a GitHub repo → deterministic static analysis (AST imports, endpoints,
risk, impact, dead code) → 10 dedicated intelligence pages. **Tunner** (optional AI)
adds explanations on top — analysis works without any API key.

**Stack:** React + React Flow · Fastify · sql.js (SQLite) · pnpm monorepo

**Dev:**
```bash
pnpm --filter @nodemap/api dev   # http://localhost:3001
pnpm --filter @nodemap/web dev   # http://localhost:5173
```

---

## Architecture (post-refactor)

### Backend pipeline (deterministic, no AI required)

```
ingestion          (apps/api/src/services/ingestion.ts)
  ├─ scanner      (existing walkDir + classification)
  ├─ astParser    (regex imports — TS/JS)
  ├─ symbolParser (regex functions/classes)
  └─ dependencyResolver

analysis/         (apps/api/src/analysis/)
  ├─ endpoints/endpointDetector.ts   ← Express/Fastify/Koa/Hapi/Nest route detection
  ├─ endpoints/endpointFlow.ts       ← route → controller → service → repo flow
  ├─ layers/layerClassifier.ts       ← route/controller/service/repo/middleware/...
  ├─ dependencies/circular.ts        ← Tarjan SCC
  ├─ risk/riskEngine.ts              ← formula: incoming*3 + outgoing*2 + endpoints*5 + cycle + size + complexity
  ├─ impact/impactEngine.ts          ← reverse BFS for direct/indirect dependents
  ├─ deadcode/deadCodeEngine.ts      ← confidence + false-positive reasons
  ├─ reports/reportGenerator.ts      ← Markdown + JSON export
  ├─ repoAnalysis.ts                 ← single RepoAnalysis envelope
  └─ analysisCache.ts                ← cached in analysis_results

ai/               (apps/api/src/ai/)
  ├─ providers/AIProvider.ts         ← interface + Disabled
  ├─ providers/OpenAIProvider.ts     ← model-aware (o-series vs gpt-4o), trimmed keys, clear errors
  ├─ providers/GeminiProvider.ts     ← fixed payload + gemini-2.0-flash default
  └─ aiService.ts                    ← provider-aware brief + explain (cached)
```

### Frontend pages (10 total)

| Route | Page | Purpose |
|---|---|---|
| `/dashboard` | DashboardPage | Health score, stat cards, top risky/connected, endpoint method mix, repo list |
| `/repo-graph` | RepoGraphPage | Folder/file tree + **line views** (Tree, Imports, API, Circular, All) |
| `/dependency-graph` | DependencyGraphPage | Layer-coloured file→file graph (stacked rows) + impact side panel |
| `/endpoint-map` | EndpointMapPage | Dropdown of detected endpoints → step-by-step execution flow |
| `/risk-map` | RiskMapPage | Risk-ranked file list with reasons + **Ask Tunner** |
| `/pr-impact` | PRImpactPage | Manual changed-file list → impact analysis (GitHub integration placeholder) |
| `/dead-code` | DeadCodePage | Confidence-graded candidates with false-positive caveats |
| `/tunner` | AIExplainerPage | Repo brief + per-file explain (**Tunner**; `/ai-explainer` redirects here) |
| `/reports` | ReportsPage | Markdown + JSON export (sections selectable) |
| `/settings` | SettingsPage | AI provider, API key, model, test connection, ignored paths |

Layout: persistent **sidebar** + **RepoSelector** in top bar.
Active repo persisted via Zustand+localStorage (`activeRepoStore`).

---

## Tunner (AI branding)

- User-facing name: **Tunner** (not “AI Explainer”)
- Copy centralised in `apps/web/src/constants/tunner.ts`
- Route: `/tunner` (legacy `/ai-explainer` → redirect)
- Buttons: **Ask Tunner**, **Explained by Tunner**
- AI is optional; all deterministic pages work without a key

---

## Repo Graph — line views & layout

**Problem solved:** One canvas with every edge type was cluttered; expanding folders showed nested files too early.

**Structure (Tree) view** — `edgeView === 'structure'`
- Custom top-down **flat tree** only (`subtreeW` / `placeNode` in `graphLayout.ts`)
- Expanding a folder shows **direct children only** (files + subfolders in one row)
- Tree edges only (smoothstep hierarchy lines)

**Flow views** — Imports, API, Circular, All (+ Combined)
- Separate **stacked-row layout** (`computeGlobalFlowLayout` in `graphLayout.ts`)
- Rows: Entry → App/root → Pages → Components → Services → Data/HTTP → Styles
- Downward step edges; row labels on the left
- Shallow folders auto-expanded for flow; no tree lines on these views

**Layout module:** `apps/web/src/lib/graphLayout.ts` (extracted from `GraphCanvas.tsx`)

**Toolbar:** `GraphToolbar.tsx` — edge view chips + edge-type filters + Tunner panel hook

---

## Dependency Graph page

- Files only, positioned by architecture layer (not the repo folder tree)
- Custom `DepFileNode`; `fitView` on load
- Fixed empty/broken canvas regression (restored visibility + layout)

---

## Settings & API keys

| Item | Location |
|------|----------|
| SQLite DB | `apps/api/data/nodemap.db` |
| Table | `app_settings` (key/value) |
| OpenAI key | row `ai.key.openai` |
| Gemini key | row `ai.key.gemini` |
| Provider / model | `ai.provider`, `ai.model` |
| Env fallback | `apps/api/.env` → `OPENAI_API_KEY`, `GEMINI_API_KEY` |

- Keys are **never** returned to the browser (`apiKeySet: boolean` only)
- **Test connection** saves provider + model + key first, then pings the provider
- OpenAI: default model `gpt-4o-mini`; reasoning models (`o1`, `o3`, `gpt-5`) skip unsupported params; test uses simple reply (no JSON mode)
- Gemini: fixed `systemInstruction` / contents shape; default `gemini-2.0-flash`

---

## Data model

Single `RepoAnalysis` object (cached in `analysis_results` table) drives every page:

```ts
{
  repoId, repoName, framework, languages,
  fileCount, folderCount, totalSize,
  dependencies: { total, internal, external, circular: string[][] },
  endpoints: DetectedEndpoint[],
  riskScores: RiskScore[],
  deadCodeCandidates: DeadCodeCandidate[],
  layers: FileLayerInfo[],
  topConnected, endpointsByMethod,
  healthScore, highRiskCount, mediumRiskCount, generatedAt
}
```

---

## ✅ Done (refactor + follow-ups)

### Backend (intelligence platform)
- [x] Shared type model, endpoint detector, layer classifier, risk/impact/dead code engines
- [x] Endpoint flow builder, Tarjan circular deps, report generator
- [x] AI provider abstraction (OpenAI, Gemini, Disabled)
- [x] Settings store + routes (`/settings`, `/settings/ai/test`)
- [x] Analysis cache (`analysis_v1`), invalidated on re-ingest
- [x] OpenAI provider hardening (model-aware body, key trim, clearer 400 messages)
- [x] Gemini provider payload fix

### Frontend (10 pages + layout)
- [x] Sidebar, RepoSelector, Dashboard, all intelligence pages
- [x] Repo Graph under new shell with **line views** + `graphLayout.ts`
- [x] Dependency Graph (layered file graph, fixed render)
- [x] **Tunner** rebrand (`/tunner`, constants, Risk Map + toolbar + settings copy)
- [x] Settings: test saves first, OpenAI hints, full error display
- [x] Web + API build/type-check green

---

## Smoke-tested

Against `repo_cMf-dWtlb-SqN8Vw` (EVAT-App-BE, Express, 181 files):
- 165 endpoints detected
- 1 circular dep group, 7 dead code candidates, 29 high-risk files
- Health: 74/100
- Endpoint flow correctly chains: `POST /` → middleware → route → controller → service → repository → database → response

---

## 📋 Remaining nice-to-haves

- [ ] Real GitHub OAuth + PR fetching (PR Impact currently manual)
- [ ] TypeScript AST parser (current regex parser misses decorators / complex generics)
- [ ] Real-time webhook re-ingest
- [ ] Mermaid export
- [ ] Cross-repo / monorepo package boundary analysis
- [ ] Deploy live demo
- [ ] Update README + CLAUDE.md for Tunner route and graph line views
- [ ] `reingestFromDirectory` for re-scan (currently 501)

---

## Key files

| Area | Path |
|------|------|
| Graph layout (tree + flow) | `apps/web/src/lib/graphLayout.ts` |
| Repo graph canvas | `apps/web/src/components/graph/GraphCanvas.tsx` |
| Graph toolbar / line views | `apps/web/src/components/graph/GraphToolbar.tsx` |
| Dependency graph | `apps/web/src/components/graph/DependencyGraphCanvas.tsx` |
| Tunner copy | `apps/web/src/constants/tunner.ts` |
| Tunner page | `apps/web/src/pages/AIExplainerPage.tsx` |
| Settings UI | `apps/web/src/pages/SettingsPage.tsx` |
| Settings / keys (API) | `apps/api/src/storage/settingsStore.ts` |
| OpenAI provider | `apps/api/src/ai/providers/OpenAIProvider.ts` |
| Endpoint detector | `apps/api/src/analysis/endpoints/endpointDetector.ts` |
| Unified analysis | `apps/api/src/analysis/repoAnalysis.ts` |
| Sidebar | `apps/web/src/components/layout/Sidebar.tsx` |
