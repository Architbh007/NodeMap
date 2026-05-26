import type { AppSettings, AiProviderId, UpdateSettingsInput } from '@nodemap/types';
import { dbGet, dbRun } from './db.js';

/**
 * Settings storage.
 * - Persistent key-value pairs in `app_settings` table.
 * - API keys are stored in the DB by intent (single-user local app).
 *   They are masked in the `AppSettings` response (`apiKeySet` boolean only).
 */

interface KV { key: string; value: string }

function getKV(key: string): string | undefined {
  return dbGet<KV>('SELECT value FROM app_settings WHERE key = ?', [key])?.value;
}

function setKV(key: string, value: string): void {
  const existing = dbGet<KV>('SELECT key FROM app_settings WHERE key = ?', [key]);
  if (existing) {
    dbRun('UPDATE app_settings SET value = ? WHERE key = ?', [value, key]);
  } else {
    dbRun('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

function deleteKV(key: string): void {
  dbRun('DELETE FROM app_settings WHERE key = ?', [key]);
}

const KEYS = {
  aiProvider: 'ai.provider',
  aiModel:    'ai.model',
  aiKeyOpenAI: 'ai.key.openai',
  aiKeyGemini: 'ai.key.gemini',
  ignored:    'ignoredPaths',
  graphShowExternal: 'graph.showExternal',
  graphEdgeAnim: 'graph.edgeAnim',
  githubToken: 'github.token',
};

function fallback<T>(v: T | undefined, d: T): T { return v === undefined ? d : v; }

export function getSettings(): AppSettings {
  const provider = (getKV(KEYS.aiProvider) ?? process.env.NODEMAP_AI_PROVIDER ?? 'disabled') as AiProviderId;
  const openaiKey = getKV(KEYS.aiKeyOpenAI) ?? process.env.OPENAI_API_KEY ?? '';
  const geminiKey = getKV(KEYS.aiKeyGemini) ?? process.env.GEMINI_API_KEY ?? '';
  const aiModelRaw = getKV(KEYS.aiModel) ?? process.env.OPENAI_MODEL ?? '';
  const aiModel = aiModelRaw.trim() || undefined;

  const ignored = (() => {
    try { return JSON.parse(getKV(KEYS.ignored) ?? '[]') as string[]; }
    catch { return []; }
  })();

  const apiKeySet = provider === 'openai' ? !!openaiKey :
                    provider === 'gemini' ? !!geminiKey : false;

  return {
    ai: {
      provider,
      apiKeySet,
      model: aiModel,
    },
    ignoredPaths: ignored,
    graph: {
      showExternalModules: fallback(getKV(KEYS.graphShowExternal), 'false') === 'true',
      edgeAnimations: fallback(getKV(KEYS.graphEdgeAnim), 'true') === 'true',
    },
    github: {
      connected: !!getKV(KEYS.githubToken),
    },
  };
}

export function getAiApiKey(provider: AiProviderId): string | undefined {
  if (provider === 'openai') {
    const key = getKV(KEYS.aiKeyOpenAI) ?? process.env.OPENAI_API_KEY;
    return key?.trim() || undefined;
  }
  if (provider === 'gemini') return getKV(KEYS.aiKeyGemini) ?? process.env.GEMINI_API_KEY;
  return undefined;
}

export function getGithubToken(): string | undefined {
  const key = getKV(KEYS.githubToken) ?? process.env.GITHUB_TOKEN;
  return key?.trim() || undefined;
}

export function updateSettings(update: UpdateSettingsInput): AppSettings {
  if (update.ai) {
    if (update.ai.provider) setKV(KEYS.aiProvider, update.ai.provider);
    if (update.ai.model) setKV(KEYS.aiModel, update.ai.model);
    if (update.ai.apiKey !== undefined) {
      const p = update.ai.provider ?? (getKV(KEYS.aiProvider) as AiProviderId | undefined) ?? 'openai';
      const key = update.ai.apiKey.trim();
      if (!key) {
        if (p === 'openai') deleteKV(KEYS.aiKeyOpenAI);
        else if (p === 'gemini') deleteKV(KEYS.aiKeyGemini);
      } else if (p === 'openai') {
        setKV(KEYS.aiKeyOpenAI, key);
      } else if (p === 'gemini') {
        setKV(KEYS.aiKeyGemini, key);
      }
    }
  }
  if (update.ignoredPaths) setKV(KEYS.ignored, JSON.stringify(update.ignoredPaths));
  if (update.graph) {
    if (update.graph.showExternalModules !== undefined) setKV(KEYS.graphShowExternal, String(update.graph.showExternalModules));
    if (update.graph.edgeAnimations !== undefined) setKV(KEYS.graphEdgeAnim, String(update.graph.edgeAnimations));
  }
  if (update.github?.token !== undefined) {
    const token = update.github.token.trim();
    if (!token) deleteKV(KEYS.githubToken);
    else setKV(KEYS.githubToken, token);
  }
  return getSettings();
}
