import path from 'path';
import type { DeadCodeCandidate, DetectedEndpoint } from '@nodemap/types';
import type { FileRow, DependencyRow } from '../../types/index.js';

/**
 * Dead Code Candidate Detector
 *
 * A file is a *candidate* (NOT definitely dead) when ALL of these hold:
 *  - no incoming imports (no other repo file imports it)
 *  - it is not an entry point (index/main/server at repo root)
 *  - it is not a config file
 *  - it is not a route file (would be the source of an endpoint)
 *  - it is not a test file
 *  - it is not framework-required (e.g. next.config.ts, vite.config.ts)
 *  - it is not a known public asset
 *
 * Returns confidence (low/medium/high) and reasons + false-positive caveats.
 */

const FRAMEWORK_FILES = new Set([
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'webpack.config.js', 'webpack.config.ts',
  'rollup.config.js', 'rollup.config.ts',
  'svelte.config.js', 'svelte.config.ts',
  'nuxt.config.js', 'nuxt.config.ts',
  'astro.config.js', 'astro.config.mjs',
  'tailwind.config.js', 'tailwind.config.ts',
  'postcss.config.js', 'postcss.config.cjs',
  'jest.config.js', 'jest.config.ts',
  'vitest.config.js', 'vitest.config.ts',
  'eslint.config.js', 'eslint.config.mjs',
  'tsup.config.ts', 'tsconfig.json',
  'playwright.config.ts', 'cypress.config.ts',
  '.eslintrc.js', '.eslintrc.cjs',
  'babel.config.js', 'babel.config.cjs',
]);

const ENTRY_POINT_NAMES = new Set([
  'index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs',
  'main.ts', 'main.tsx', 'main.js', 'main.jsx',
  'server.ts', 'server.js',
  'app.ts', 'app.tsx', 'app.js', 'app.jsx',
  'bootstrap.ts', 'bootstrap.js',
  '__init__.py',
]);

function isLikelyEntry(filePath: string): boolean {
  const parts = filePath.split('/');
  const name = parts[parts.length - 1].toLowerCase();
  if (!ENTRY_POINT_NAMES.has(name)) return false;
  // Only treat as entry if depth is shallow (root, src/, app/, ...)
  return parts.length <= 3;
}

function isFrameworkFile(filePath: string): boolean {
  const name = filePath.split('/').pop()?.toLowerCase() ?? '';
  return FRAMEWORK_FILES.has(name) || name.startsWith('.eslintrc');
}

function isAsset(filePath: string): boolean {
  return /(?:^|\/)(public|static|assets?)\//i.test(filePath);
}

function isStorybook(filePath: string): boolean {
  return /\.(stories|story)\.[jt]sx?$/i.test(filePath) || /\/\.storybook\//i.test(filePath);
}

function isTypeOnly(filePath: string): boolean {
  return /\.d\.ts$/i.test(filePath) || /\/types?\//i.test(filePath);
}

function isMigration(filePath: string): boolean {
  return /\/migrations?\//i.test(filePath) || /\/seeds?\//i.test(filePath);
}

export interface DeadCodeInput {
  files: FileRow[];
  deps: DependencyRow[];
  endpoints: DetectedEndpoint[];
  /** Specifiers that appeared in dynamic imports — guarded false-positive. */
  dynamicSpecifiers?: Set<string>;
}

export function detectDeadCode(input: DeadCodeInput): DeadCodeCandidate[] {
  const { files, deps, endpoints } = input;

  // who-imports-who: target -> Set<source>
  const importedBy = new Map<string, Set<string>>();
  for (const f of files) importedBy.set(f.id, new Set());
  for (const d of deps) {
    if (!d.target_file_id) continue;
    importedBy.get(d.target_file_id)?.add(d.source_file_id);
  }

  // Files that appear in any endpoint chain are *not* dead code
  const endpointFiles = new Set<string>();
  for (const ep of endpoints) {
    if (ep.routeFileId) endpointFiles.add(ep.routeFileId);
    if (ep.controllerFileId) endpointFiles.add(ep.controllerFileId);
    for (const id of ep.serviceChainIds) endpointFiles.add(id);
    for (const id of ep.repositoryChainIds) endpointFiles.add(id);
  }

  const candidates: DeadCodeCandidate[] = [];

  for (const f of files) {
    if (f.type !== 'source') continue;
    const incoming = importedBy.get(f.id);
    if (incoming && incoming.size > 0) continue;
    if (isLikelyEntry(f.path)) continue;
    if (isFrameworkFile(f.path)) continue;
    if (isAsset(f.path)) continue;
    if (endpointFiles.has(f.id)) continue;

    const reasons: string[] = ['No incoming imports detected'];
    const falsePositives: string[] = [];
    let confidence: DeadCodeCandidate['confidence'] = 'high';

    if (isStorybook(f.path)) {
      reasons.push('Looks like a Storybook story');
      falsePositives.push('Storybook stories are loaded by config, not by import');
      confidence = 'low';
    }
    if (isTypeOnly(f.path)) {
      reasons.push('Type-only file — may be referenced via `import type`');
      falsePositives.push('TypeScript ambient/declaration files are often referenced implicitly');
      confidence = 'low';
    }
    if (isMigration(f.path)) {
      reasons.push('Looks like a migration/seed');
      falsePositives.push('Migrations are typically run by an external tool, not imported');
      confidence = 'low';
    }
    if (/\.test\.|\.spec\./.test(f.path)) {
      reasons.push('Test file');
      falsePositives.push('Test files are loaded by the test runner via glob, not imports');
      confidence = 'low';
    }
    if (path.basename(f.path).startsWith('_')) {
      falsePositives.push('Underscore-prefixed — may be a framework-specific file (e.g. Next.js `_app.tsx`)');
      confidence = confidence === 'high' ? 'medium' : confidence;
    }

    // If file path matches a dynamic-import specifier seen elsewhere, downgrade
    if (input.dynamicSpecifiers?.size) {
      const fileBase = path.basename(f.path).replace(/\.(t|j)sx?$/, '');
      for (const spec of input.dynamicSpecifiers) {
        if (spec.includes(fileBase)) {
          falsePositives.push('Matches a dynamic import specifier elsewhere in the codebase');
          confidence = 'low';
          break;
        }
      }
    }

    // High confidence requires: only one import edge missing AND no fp caveats
    if (confidence === 'high' && falsePositives.length === 0 && f.line_count > 30) {
      // promote to high — non-trivial file
    } else if (falsePositives.length === 0 && f.line_count <= 30) {
      confidence = 'medium';
      reasons.push('Small file — could be stub or placeholder');
    }

    candidates.push({
      fileId: f.id,
      path: f.path,
      confidence,
      reasons,
      falsePositiveReasons: falsePositives,
    });
  }

  candidates.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    if (order[a.confidence] !== order[b.confidence]) {
      return order[a.confidence] - order[b.confidence];
    }
    return a.path.localeCompare(b.path);
  });

  return candidates;
}
