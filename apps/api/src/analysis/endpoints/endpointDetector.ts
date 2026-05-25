import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import type { DetectedEndpoint, HttpMethod } from '@nodemap/types';
import { UPLOADS_DIR } from '../../services/ingestion.js';
import type { FileRow, DependencyRow } from '../../types/index.js';

/**
 * Endpoint Detector
 * Scans repo files for HTTP endpoint declarations across common Node.js frameworks
 * (Express, Fastify, Koa, NestJS-light) using regex.
 *
 * Detection strategy is deliberately conservative: prefer precision over recall.
 * If a project is purely frontend / has no detectable endpoints, returns [].
 */

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'] as const;

// app.METHOD('path', ...) or router.METHOD('path', ...)
// Fastify supports app.METHOD(path, opts, handler) and app.route({ method, url, handler })
const RE_EXPRESS_LIKE = new RegExp(
  `\\b(?:app|router|api|server|fastify|express|route|r)\\s*\\.\\s*(${HTTP_METHODS.join('|')})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
  'gi',
);

// NestJS decorator pattern: @Get(), @Post('path')
const RE_NEST_DECORATOR = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*['"\`]?([^'"\`)]*)['"\`]?\s*\)/g;

// Fastify route() — app.route({ method: ['GET', 'POST'], url: '/x', handler: ... })
const RE_FASTIFY_ROUTE = /\.\s*route\s*\(\s*\{\s*method\s*:\s*['"\`]?([A-Z,\s'"\`]+?)['"\`]?\s*,\s*url\s*:\s*['"\`]([^'"\`]+)['"\`]/g;

// Koa-router style: router.get('/x', handler) — same regex as RE_EXPRESS_LIKE actually
// Hapi: server.route({ method: 'GET', path: '/x', handler: ... })
const RE_HAPI_ROUTE = /\.\s*route\s*\(\s*\{\s*method\s*:\s*['"\`]?([A-Z]+)['"\`]?\s*,\s*path\s*:\s*['"\`]([^'"\`]+)['"\`]/g;

// Mount prefix: app.use('/prefix', router) — used to compute final path
const RE_USE_MOUNT = /\b(?:app|router|api|server)\s*\.\s*use\s*\(\s*['"\`]([^'"\`]+)['"\`]\s*,\s*(\w+)/g;

interface RawEndpoint {
  method: HttpMethod;
  path: string;
  routeFile: string;
  handler?: string;
  handlerLine?: number;
  framework: DetectedEndpoint['framework'];
}

function normaliseMethod(m: string): HttpMethod | null {
  const up = m.trim().toUpperCase();
  const allowed: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (allowed.includes(up as HttpMethod)) return up as HttpMethod;
  if (up === 'ALL') return 'GET';
  return null;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '');
}

function getLineNumber(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function extractHandlerNear(source: string, callIndex: number): string | undefined {
  // Look at characters after the path string to grab the next identifier or arrow fn.
  const slice = source.slice(callIndex, callIndex + 400);
  // pattern: 'path', identifier
  const idMatch = /,\s*(?:\[\s*[^\]]*\]\s*,\s*)?([A-Za-z_][A-Za-z0-9_.$]*)\s*[),]/.exec(slice);
  if (idMatch) {
    const candidate = idMatch[1];
    if (!['async', 'function', 'req', 'request', 'next', 'res'].includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function isParseableFile(p: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(p);
}

function looksLikeRouteFile(filePath: string, content: string): boolean {
  const lower = filePath.toLowerCase();
  if (/route|router|controller|handler|endpoint|api/i.test(lower)) return true;
  if (/express|fastify|koa|hapi|@nestjs/.test(content)) return true;
  return /\b(app|router|server|fastify)\s*\.\s*(get|post|put|patch|delete)\s*\(/i.test(content);
}

export function detectEndpointsInFile(
  absPath: string,
  relativePath: string,
): RawEndpoint[] {
  if (!isParseableFile(relativePath)) return [];

  let raw: string;
  try { raw = readFileSync(absPath, 'utf8'); }
  catch { return []; }

  if (!looksLikeRouteFile(relativePath, raw)) return [];

  const source = stripComments(raw);
  const endpoints: RawEndpoint[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;

  RE_EXPRESS_LIKE.lastIndex = 0;
  while ((m = RE_EXPRESS_LIKE.exec(source)) !== null) {
    const method = normaliseMethod(m[1]);
    if (!method) continue;
    const routePath = m[2];
    const key = `${method}:${routePath}:${relativePath}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const callIndex = m.index + m[0].length;
    endpoints.push({
      method,
      path: routePath,
      routeFile: relativePath,
      handler: extractHandlerNear(source, callIndex),
      handlerLine: getLineNumber(source, m.index),
      framework:
        /\bfastify\b/i.test(source) ? 'fastify' :
        /\bexpress\b/i.test(source) ? 'express' :
        /\bkoa\b/i.test(source) ? 'koa' :
        /\b@nestjs/i.test(source) ? 'nest' : 'router',
    });
  }

  RE_NEST_DECORATOR.lastIndex = 0;
  while ((m = RE_NEST_DECORATOR.exec(source)) !== null) {
    const method = normaliseMethod(m[1]);
    if (!method) continue;
    const routePath = m[2] || '/';
    const key = `${method}:${routePath}:${relativePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push({
      method,
      path: routePath,
      routeFile: relativePath,
      handlerLine: getLineNumber(source, m.index),
      framework: 'nest',
    });
  }

  RE_FASTIFY_ROUTE.lastIndex = 0;
  while ((m = RE_FASTIFY_ROUTE.exec(source)) !== null) {
    const methods = m[1].split(',').map((s) => s.replace(/['"\s`]/g, ''));
    const routePath = m[2];
    for (const meth of methods) {
      const method = normaliseMethod(meth);
      if (!method) continue;
      const key = `${method}:${routePath}:${relativePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      endpoints.push({
        method,
        path: routePath,
        routeFile: relativePath,
        handlerLine: getLineNumber(source, m.index),
        framework: 'fastify',
      });
    }
  }

  RE_HAPI_ROUTE.lastIndex = 0;
  while ((m = RE_HAPI_ROUTE.exec(source)) !== null) {
    const method = normaliseMethod(m[1]);
    if (!method) continue;
    const routePath = m[2];
    const key = `${method}:${routePath}:${relativePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push({
      method,
      path: routePath,
      routeFile: relativePath,
      handlerLine: getLineNumber(source, m.index),
      framework: 'router',
    });
  }

  return endpoints;
}

/**
 * Detect all endpoints across the repo + augment with controller/service chains
 * derived from the dependency graph.
 */
export function detectEndpoints(
  repoId: string,
  files: FileRow[],
  deps: DependencyRow[],
): DetectedEndpoint[] {
  const repoRoot = path.join(UPLOADS_DIR, repoId);
  const altRoots: string[] = [];
  try {
    if (existsSync(repoRoot)) {
      const entries = readdirSync(repoRoot).filter((e) => !e.startsWith('.'));
      if (entries.length === 1) {
        altRoots.push(path.join(repoRoot, entries[0]));
      }
    }
  } catch { /* ignore */ }

  function resolveAbs(rel: string): string | null {
    const primary = path.join(repoRoot, rel);
    if (existsSync(primary)) return primary;
    for (const alt of altRoots) {
      const candidate = path.join(alt, rel);
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  // Maps for chain resolution
  const fileByPath = new Map<string, FileRow>();
  for (const f of files) fileByPath.set(f.path, f);

  const importsByFile = new Map<string, Set<string>>(); // fileId -> set of imported fileIds
  for (const d of deps) {
    if (!d.target_file_id) continue;
    let set = importsByFile.get(d.source_file_id);
    if (!set) { set = new Set(); importsByFile.set(d.source_file_id, set); }
    set.add(d.target_file_id);
  }

  const detected: DetectedEndpoint[] = [];

  for (const f of files) {
    if (f.type !== 'source') continue;
    const abs = resolveAbs(f.path);
    if (!abs) continue;
    const raw = detectEndpointsInFile(abs, f.path);
    for (const r of raw) {
      const chain = walkChainFromFile(f.id, importsByFile, fileByPath, files);
      const id = `${r.method}:${r.path}:${f.path}`;

      detected.push({
        id,
        method: r.method,
        path: r.path,
        routeFile: f.path,
        routeFileId: f.id,
        handler: r.handler,
        handlerLine: r.handlerLine,
        controllerFile: chain.controllerFile,
        controllerFileId: chain.controllerFileId,
        serviceChain: chain.services,
        serviceChainIds: chain.serviceIds,
        repositoryChain: chain.repositories,
        repositoryChainIds: chain.repositoryIds,
        middleware: chain.middleware,
        externalServices: chain.externalServices,
        database: chain.database,
        framework: r.framework,
      });
    }
  }

  detected.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return detected;
}

interface ChainResult {
  controllerFile?: string;
  controllerFileId?: string;
  services: string[];
  serviceIds: string[];
  repositories: string[];
  repositoryIds: string[];
  middleware: string[];
  externalServices: string[];
  database?: string;
}

function classifyByPath(p: string): 'controller' | 'service' | 'repository' | 'middleware' | 'model' | 'config' | 'other' {
  const lower = p.toLowerCase();
  if (/\b(controller|handler)\b/.test(lower)) return 'controller';
  if (/\b(service|usecase|use-case|business)\b/.test(lower)) return 'service';
  if (/\b(repository|repo|dao|store|db|database|data-access)\b/.test(lower)) return 'repository';
  if (/\b(middleware|guard|interceptor|filter)\b/.test(lower)) return 'middleware';
  if (/\b(model|schema|entity)\b/.test(lower)) return 'model';
  if (/\b(config|env)\b/.test(lower)) return 'config';
  return 'other';
}

function walkChainFromFile(
  startId: string,
  importsByFile: Map<string, Set<string>>,
  _fileByPath: Map<string, FileRow>,
  files: FileRow[],
): ChainResult {
  const fileById = new Map<string, FileRow>();
  for (const f of files) fileById.set(f.id, f);

  const result: ChainResult = {
    services: [],
    serviceIds: [],
    repositories: [],
    repositoryIds: [],
    middleware: [],
    externalServices: [],
  };

  const visited = new Set<string>();
  const queue: string[] = [startId];
  // BFS up to depth 4 — keeps chains tight
  let depth = 0;
  const MAX_DEPTH = 4;

  while (queue.length && depth < MAX_DEPTH) {
    const nextQueue: string[] = [];
    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      const f = fileById.get(id);
      if (!f) continue;
      const cls = classifyByPath(f.path);
      switch (cls) {
        case 'controller':
          if (!result.controllerFile) {
            result.controllerFile = f.path;
            result.controllerFileId = f.id;
          }
          break;
        case 'service':
          if (!result.services.includes(f.path)) {
            result.services.push(f.path);
            result.serviceIds.push(f.id);
          }
          break;
        case 'repository':
          if (!result.repositories.includes(f.path)) {
            result.repositories.push(f.path);
            result.repositoryIds.push(f.id);
          }
          break;
        case 'middleware':
          if (!result.middleware.includes(f.path)) {
            result.middleware.push(f.path);
          }
          break;
      }
      const imports = importsByFile.get(id);
      if (imports) {
        for (const tgt of imports) if (!visited.has(tgt)) nextQueue.push(tgt);
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
    depth++;
  }

  return result;
}
