import type { ArchitectureLayer, FileLayerInfo } from '@nodemap/types';
import type { FileRow } from '../../types/index.js';

/**
 * Layer Classifier
 * Assigns each file a deterministic architecture layer based on path heuristics
 * and file metadata. Used by Dependency Graph, Endpoint Map and Risk Map pages.
 */

interface Pattern {
  regex: RegExp;
  layer: ArchitectureLayer;
  confidence: 'low' | 'medium' | 'high';
}

const PATTERNS: Pattern[] = [
  // entry points
  { regex: /(?:^|\/)(index|main|server|app|bootstrap)\.[jt]sx?$/i, layer: 'entry', confidence: 'medium' },
  // routes
  { regex: /(?:^|\/)(routes?|router|endpoints?|api)\//i, layer: 'route', confidence: 'high' },
  { regex: /\.routes?\.[jt]sx?$/i, layer: 'route', confidence: 'high' },
  { regex: /[Rr]outes?\.[jt]sx?$/, layer: 'route', confidence: 'medium' },
  // controllers
  { regex: /(?:^|\/)controllers?\//i, layer: 'controller', confidence: 'high' },
  { regex: /\.controller\.[jt]sx?$/i, layer: 'controller', confidence: 'high' },
  { regex: /[Cc]ontroller\.[jt]sx?$/, layer: 'controller', confidence: 'medium' },
  { regex: /\.handler\.[jt]sx?$/i, layer: 'controller', confidence: 'medium' },
  // services
  { regex: /(?:^|\/)services?\//i, layer: 'service', confidence: 'high' },
  { regex: /\.service\.[jt]sx?$/i, layer: 'service', confidence: 'high' },
  { regex: /[Ss]ervice\.[jt]sx?$/, layer: 'service', confidence: 'medium' },
  { regex: /\/(usecase|use-case|usecases|business)\//i, layer: 'service', confidence: 'medium' },
  // repositories / data access
  { regex: /(?:^|\/)(repositories|repos|dao|stores)\//i, layer: 'repository', confidence: 'high' },
  { regex: /\.repository\.[jt]sx?$/i, layer: 'repository', confidence: 'high' },
  { regex: /[Rr]epository\.[jt]sx?$/, layer: 'repository', confidence: 'medium' },
  { regex: /(?:^|\/)(db|database|data-access|persistence)\//i, layer: 'repository', confidence: 'medium' },
  // middleware
  { regex: /(?:^|\/)(middlewares?|guards?|interceptors?|filters?)\//i, layer: 'middleware', confidence: 'high' },
  { regex: /\.(middleware|guard|interceptor|filter)\.[jt]sx?$/i, layer: 'middleware', confidence: 'high' },
  { regex: /[Mm]iddleware\.[jt]sx?$/, layer: 'middleware', confidence: 'medium' },
  // models / entities
  { regex: /(?:^|\/)(models?|entities|schemas?|domain)\//i, layer: 'model', confidence: 'high' },
  { regex: /\.(model|entity|schema)\.[jt]sx?$/i, layer: 'model', confidence: 'high' },
  // views / components (frontend)
  { regex: /(?:^|\/)(components|views|pages|screens|ui)\//i, layer: 'view', confidence: 'high' },
  { regex: /\.(component|view|page|screen)\.[jt]sx?$/i, layer: 'view', confidence: 'medium' },
  // utils
  { regex: /(?:^|\/)(utils?|helpers?|lib|libs|common|shared)\//i, layer: 'util', confidence: 'high' },
  { regex: /\.util\.[jt]sx?$/i, layer: 'util', confidence: 'high' },
  // config
  { regex: /(?:^|\/)(config|configs|configuration)\//i, layer: 'config', confidence: 'high' },
  { regex: /\.(config|env)\.[jt]sx?$/i, layer: 'config', confidence: 'high' },
];

export function classifyFile(filePath: string, type?: string): FileLayerInfo['layer'] {
  if (type === 'test') return 'test';
  if (type === 'config') return 'config';

  for (const p of PATTERNS) {
    if (p.regex.test(filePath)) return p.layer;
  }
  return 'unknown';
}

export function classifyAllFiles(files: FileRow[]): FileLayerInfo[] {
  const out: FileLayerInfo[] = [];
  for (const f of files) {
    if (f.type === 'test') {
      out.push({ fileId: f.id, path: f.path, layer: 'test', confidence: 'high' });
      continue;
    }
    if (f.type === 'config') {
      out.push({ fileId: f.id, path: f.path, layer: 'config', confidence: 'high' });
      continue;
    }
    let match: Pattern | null = null;
    for (const p of PATTERNS) {
      if (p.regex.test(f.path)) { match = p; break; }
    }
    if (match) {
      out.push({ fileId: f.id, path: f.path, layer: match.layer, confidence: match.confidence });
    } else {
      out.push({ fileId: f.id, path: f.path, layer: 'unknown', confidence: 'low' });
    }
  }
  return out;
}

export const LAYER_COLORS: Record<ArchitectureLayer, string> = {
  route:      '#60a5fa', // blue
  controller: '#a78bfa', // purple
  service:    '#34d399', // green
  repository: '#fbbf24', // yellow
  middleware: '#f472b6', // pink
  util:       '#94a3b8', // slate
  config:     '#6b7280', // gray
  model:      '#fb923c', // orange
  view:       '#22d3ee', // cyan
  test:       '#475569', // slate dark
  entry:      '#00ff87', // primary
  unknown:    '#525252', // neutral
};

export const LAYER_LABELS: Record<ArchitectureLayer, string> = {
  route:      'Route',
  controller: 'Controller',
  service:    'Service',
  repository: 'Repository',
  middleware: 'Middleware',
  util:       'Utility',
  config:     'Config',
  model:      'Model',
  view:       'View',
  test:       'Test',
  entry:      'Entry',
  unknown:    'Module',
};
