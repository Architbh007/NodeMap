import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { dbGet, dbRun } from '../storage/db.js';
import { generateId, now } from '../utils/id.js';
import { getOrBuildAnalysis } from '../analysis/analysisCache.js';
import { UPLOADS_DIR } from '../services/ingestion.js';
import { getSettings, getAiApiKey } from '../storage/settingsStore.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { DisabledProvider } from './providers/AIProvider.js';
import type { AIProvider } from './providers/AIProvider.js';
import type {
  AiRepoBrief, AiNodeExplain, AiStatus, RepoAnalysis,
} from '@nodemap/types';
import type { AnalysisResultRow } from '../types/index.js';

/**
 * AI Service v2
 *  - Provider-agnostic: OpenAI / Gemini / Disabled (read from app settings).
 *  - Deterministic context built from RepoAnalysis — NOT the raw repo.
 *  - Caches results in `analysis_results`.
 */

export function getProvider(): AIProvider {
  const settings = getSettings();
  const provider = settings.ai.provider;
  if (provider === 'openai') {
    const key = getAiApiKey('openai');
    if (!key) return new DisabledProvider();
    return new OpenAIProvider(key, settings.ai.model);
  }
  if (provider === 'gemini') {
    const key = getAiApiKey('gemini');
    if (!key) return new DisabledProvider();
    return new GeminiProvider(key, settings.ai.model);
  }
  return new DisabledProvider();
}

export function getAiStatus(): AiStatus {
  const p = getProvider();
  return { configured: p.isConfigured, provider: p.id, model: p.model };
}

function getCached<T>(repoId: string, type: string): T | null {
  const row = dbGet<AnalysisResultRow>(
    'SELECT data FROM analysis_results WHERE repo_id = ? AND type = ?',
    [repoId, type],
  );
  if (!row) return null;
  try { return JSON.parse(row.data) as T; } catch { return null; }
}

function setCached(repoId: string, type: string, data: unknown): void {
  const json = JSON.stringify(data);
  const existing = dbGet<AnalysisResultRow>(
    'SELECT id FROM analysis_results WHERE repo_id = ? AND type = ?',
    [repoId, type],
  );
  if (existing) {
    dbRun('UPDATE analysis_results SET data = ?, created_at = ? WHERE id = ?', [json, now(), existing.id]);
  } else {
    dbRun(
      'INSERT INTO analysis_results (id, repo_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId('analysis'), repoId, type, json, now()],
    );
  }
}

function buildBriefContext(a: RepoAnalysis): string {
  const topImported = a.topConnected.slice(0, 10).map((c) => ({
    path: c.path, dependents: c.connectionCount,
  }));
  const highRisk = a.riskScores
    .filter((r) => r.level === 'high' || r.level === 'critical')
    .slice(0, 8)
    .map((r) => ({ path: r.path, level: r.level, score: r.score }));
  const layerCounts: Record<string, number> = {};
  for (const l of a.layers) layerCounts[l.layer] = (layerCounts[l.layer] ?? 0) + 1;
  return JSON.stringify({
    repository: a.repoName,
    framework: a.framework,
    languages: a.languages,
    fileCount: a.fileCount,
    folderCount: a.folderCount,
    healthScore: a.healthScore,
    dependencies: a.dependencies,
    endpoints: a.endpoints.slice(0, 20).map((e) => `${e.method} ${e.path}`),
    layerCounts,
    topImported,
    highRisk,
  }, null, 2);
}

function readFileSnippet(repoId: string, filePath: string, maxLines = 40): string | null {
  const fullPath = path.join(UPLOADS_DIR, repoId, filePath);
  if (existsSync(fullPath)) {
    return readFileSync(fullPath, 'utf-8').split('\n').slice(0, maxLines).join('\n');
  }
  const repoDir = path.join(UPLOADS_DIR, repoId);
  if (existsSync(repoDir)) {
    const entries = readdirSync(repoDir).filter((e) => !e.startsWith('.'));
    if (entries.length === 1) {
      const nested = path.join(repoDir, entries[0], filePath);
      if (existsSync(nested)) {
        return readFileSync(nested, 'utf-8').split('\n').slice(0, maxLines).join('\n');
      }
    }
  }
  return null;
}

function buildExplainContext(a: RepoAnalysis, fileId: string, repoId: string): string | null {
  const layer = a.layers.find((l) => l.fileId === fileId);
  const risk = a.riskScores.find((r) => r.fileId === fileId);
  if (!layer) return null;

  const dependents = a.riskScores // proxy: just paths from same module
    .filter((r) => r.path !== layer.path)
    .slice(0, 3)
    .map((r) => r.path);

  const relatedEndpoints = a.endpoints
    .filter((e) =>
      e.routeFileId === fileId ||
      e.controllerFileId === fileId ||
      e.serviceChainIds.includes(fileId) ||
      e.repositoryChainIds.includes(fileId),
    )
    .slice(0, 5)
    .map((e) => `${e.method} ${e.path}`);

  const snippet = readFileSnippet(repoId, layer.path);

  return JSON.stringify({
    path: layer.path,
    layer: layer.layer,
    riskLevel: risk?.level,
    riskScore: risk?.score,
    riskReasons: risk?.reasons,
    relatedEndpoints,
    sampleDependents: dependents,
    codeSnippet: snippet,
  }, null, 2);
}

export async function generateRepoBrief(
  repoId: string,
  refresh = false,
): Promise<AiRepoBrief> {
  if (!refresh) {
    const cached = getCached<AiRepoBrief>(repoId, 'ai_brief');
    if (cached) return cached;
  }
  const provider = getProvider();
  if (!provider.isConfigured) throw new Error('AI provider is not configured');

  const analysis = getOrBuildAnalysis(repoId);
  const context = buildBriefContext(analysis);

  const system = `You are a senior software architect analyzing a codebase.
Respond ONLY with valid JSON matching this schema:
{
  "summary": "2-3 paragraphs describing architecture, main layers, and patterns",
  "entryPoints": ["3-5 file paths a new developer should read first"],
  "risks": ["3-5 concise architectural risks based on the data"]
}
Be specific. Reference actual paths from the data. Do not invent files not in the context.`;

  const raw = await provider.chat(
    [{ role: 'system', content: system }, { role: 'user', content: context }],
    { json: true, temperature: 0.3 },
  );

  let parsed: { summary?: string; entryPoints?: string[]; risks?: string[] };
  try { parsed = JSON.parse(raw); }
  catch { parsed = { summary: raw }; }

  const brief: AiRepoBrief = {
    summary: parsed.summary ?? 'Unable to generate summary.',
    entryPoints: Array.isArray(parsed.entryPoints) ? parsed.entryPoints : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    generatedAt: now(),
  };
  setCached(repoId, 'ai_brief', brief);
  return brief;
}

export async function explainNode(
  repoId: string,
  nodeId: string,
  refresh = false,
): Promise<AiNodeExplain> {
  const cacheType = `ai_explain:${nodeId}`;
  if (!refresh) {
    const cached = getCached<AiNodeExplain>(repoId, cacheType);
    if (cached) return cached;
  }
  const provider = getProvider();
  if (!provider.isConfigured) throw new Error('AI provider is not configured');

  const analysis = getOrBuildAnalysis(repoId);
  const context = buildExplainContext(analysis, nodeId, repoId);
  if (!context) throw new Error('Node not found in analysis');

  const system = `You are a senior software architect explaining a module.
Respond ONLY with valid JSON matching this schema:
{
  "summary": "1-2 sentences on what this module likely does",
  "role": "Its role in the architecture (e.g. utility, API layer, core domain)",
  "impact": "What depends on it and the blast radius if changed",
  "safeToChange": "low | medium | high — with one sentence why"
}
Use only the supplied context. Be concise and concrete.`;

  const raw = await provider.chat(
    [{ role: 'system', content: system }, { role: 'user', content: context }],
    { json: true, temperature: 0.3 },
  );

  let parsed: { summary?: string; role?: string; impact?: string; safeToChange?: string };
  try { parsed = JSON.parse(raw); } catch { parsed = { summary: raw }; }

  const layer = analysis.layers.find((l) => l.fileId === nodeId);
  const explain: AiNodeExplain = {
    nodeId,
    path: layer?.path ?? nodeId,
    summary: parsed.summary ?? '',
    role: parsed.role ?? '',
    impact: parsed.impact ?? '',
    safeToChange: parsed.safeToChange ?? 'medium',
    generatedAt: now(),
  };
  setCached(repoId, cacheType, explain);
  return explain;
}

/** Test the currently configured AI provider. */
export async function testAiConnection(): Promise<{ ok: boolean; error?: string }> {
  const p = getProvider();
  if (!p.isConfigured) return { ok: false, error: 'No provider configured' };
  return p.testConnection();
}
