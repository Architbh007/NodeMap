import AdmZip from 'adm-zip';
import path from 'path';
import { mkdirSync, existsSync, readdirSync, statSync, readFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dbTransaction, dbRunBatch, dbRun } from '../storage/db.js';
import { generateId, now } from '../utils/id.js';
import {
  safePath,
  isBinaryExtension,
  IGNORED_DIRS,
  IGNORED_FILES,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
} from '../utils/pathSecurity.js';
import { parseImports } from './astParser.js';
import { extractSymbols } from './symbolParser.js';
import { resolveImport, isRelativeImport, extractPackageName } from './dependencyResolver.js';
import { invalidateAnalysis } from '../analysis/analysisCache.js';
import type { IngestionResult, LanguageStat, FileType } from '@nodemap/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// ─── Language detection ───────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
  '.c': 'C', '.h': 'C',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.css': 'CSS', '.scss': 'CSS', '.sass': 'CSS', '.less': 'CSS',
  '.html': 'HTML', '.htm': 'HTML',
  '.json': 'JSON',
  '.yaml': 'YAML', '.yml': 'YAML',
  '.md': 'Markdown', '.mdx': 'Markdown',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.sql': 'SQL',
  '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.proto': 'Protobuf',
  '.tf': 'Terraform', '.hcl': 'HCL',
  '.dockerfile': 'Docker', // will match 'Dockerfile' by name
  '.toml': 'TOML',
  '.xml': 'XML',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R',
  '.scala': 'Scala',
  '.ex': 'Elixir', '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.clj': 'Clojure',
  '.hs': 'Haskell',
  '.nim': 'Nim',
  '.zig': 'Zig',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.astro': 'Astro',
};

const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.kt', '.cs',
  '.cpp', '.cc', '.cxx', '.c', '.h',
  '.rb', '.php', '.swift',
  '.vue', '.svelte', '.astro',
  '.ex', '.exs', '.erl', '.clj', '.hs',
  '.nim', '.zig', '.dart', '.lua', '.r', '.scala',
  '.graphql', '.gql', '.proto',
]);

const CONFIG_EXTS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
  '.xml', '.hcl', '.tf',
]);

const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less', '.styl']);

const PARSEABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro']);

const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.test\.py$/,
  /\.spec\.py$/,
  /__tests__\//,
  /\/tests?\//,
  /\/spec\//,
  /\.test\.go$/,
  /_test\.go$/,
  /Test\.java$/,
];

function classifyFile(filePath: string): FileType {
  const norm = filePath.replace(/\\/g, '/');
  if (TEST_PATTERNS.some((p) => p.test(norm))) return 'test';
  const ext = path.extname(filePath).toLowerCase();
  if (SOURCE_EXTS.has(ext)) return 'source';
  if (CONFIG_EXTS.has(ext)) return 'config';
  if (STYLE_EXTS.has(ext)) return 'style';
  const name = path.basename(filePath).toLowerCase();
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'config';
  if (name === 'makefile' || name === 'rakefile' || name === 'gemfile') return 'config';
  if (name.endsWith('.md') || name.endsWith('.mdx')) return 'other';
  return 'other';
}

function detectLanguage(filePath: string): string | undefined {
  const name = path.basename(filePath).toLowerCase();
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'Docker';
  if (name === 'makefile') return 'Makefile';
  return EXT_TO_LANG[path.extname(filePath).toLowerCase()];
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

// ─── Framework detection ──────────────────────────────────

const FRAMEWORK_MARKERS: Array<[RegExp, string]> = [
  [/\"next\"/, 'Next.js'],
  [/\"nuxt\"/, 'Nuxt.js'],
  [/\"@remix-run/, 'Remix'],
  [/\"gatsby\"/, 'Gatsby'],
  [/\"react\"/, 'React'],
  [/\"vue\"/, 'Vue'],
  [/\"svelte\"/, 'Svelte'],
  [/\"angular\"/, 'Angular'],
  [/\"@nestjs/, 'NestJS'],
  [/\"fastify\"/, 'Fastify'],
  [/\"express\"/, 'Express'],
  [/\"koa\"/, 'Koa'],
  [/\"hono\"/, 'Hono'],
  [/\"django\"/, 'Django'],
  [/\"flask\"/, 'Flask'],
  [/\"fastapi\"/, 'FastAPI'],
  [/\"spring\"/, 'Spring'],
  [/\"rails\"/, 'Rails'],
  [/\"laravel\"/, 'Laravel'],
  [/\"gin\"/, 'Gin'],
  [/\"fiber\"/, 'Fiber'],
];

function detectFramework(extractDir: string): string | undefined {
  const pkgPath = path.join(extractDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const content = readFileSync(pkgPath, 'utf8');
      for (const [pattern, framework] of FRAMEWORK_MARKERS) {
        if (pattern.test(content)) return framework;
      }
    } catch { /* ignore */ }
  }
  // Python
  for (const name of ['requirements.txt', 'Pipfile', 'pyproject.toml']) {
    const p = path.join(extractDir, name);
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf8');
        for (const [pattern, framework] of FRAMEWORK_MARKERS) {
          if (pattern.test(content)) return framework;
        }
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

// ─── ZIP extraction ───────────────────────────────────────

function extractZipSync(zipPath: string, extractDir: string): void {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  mkdirSync(extractDir, { recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let destPath: string;
    try {
      destPath = safePath(extractDir, entry.entryName);
    } catch {
      continue;
    }

    if (isBinaryExtension(entry.entryName)) continue;

    const uncompressedSize = entry.header.size;
    if (uncompressedSize > MAX_FILE_SIZE) continue;

    const parentDir = path.dirname(destPath);
    mkdirSync(parentDir, { recursive: true });

    try {
      zip.extractEntryTo(entry, parentDir, false, true);
    } catch { /* skip */ }
  }
}

// ─── Directory walker ─────────────────────────────────────

interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  type: FileType;
  language?: string;
  lineCount: number;
}

function walkDir(
  dir: string,
  rootDir: string,
  results: ScannedFile[],
  depth = 0,
): void {
  if (depth > 20) return; // prevent infinite recursion
  if (results.length >= MAX_FILE_COUNT) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_FILES.has(entry)) continue;

    const absPath = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(absPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue;
      walkDir(absPath, rootDir, results, depth + 1);
    } else if (stat.isFile()) {
      if (stat.size > MAX_FILE_SIZE) continue;
      if (isBinaryExtension(entry)) continue;

      const relativePath = path.relative(rootDir, absPath).replace(/\\/g, '/');
      const ext = path.extname(entry).toLowerCase();
      const type = classifyFile(relativePath);
      const language = detectLanguage(absPath);
      const lineCount = (type === 'source' || type === 'config' || type === 'style')
        ? countLines(absPath)
        : 0;

      results.push({
        absolutePath: absPath,
        relativePath,
        name: entry,
        extension: ext,
        size: stat.size,
        type,
        language,
        lineCount,
      });
    }
  }
}

// Detect the actual repo root: if ZIP extracted a single root folder, use that.
function findRepoRoot(extractDir: string): string {
  try {
    const entries = readdirSync(extractDir).filter((e) => !e.startsWith('.'));
    if (entries.length === 1) {
      const single = path.join(extractDir, entries[0]);
      if (statSync(single).isDirectory()) return single;
    }
  } catch { /* ignore */ }
  return extractDir;
}

// ─── Main ingestion entry point ───────────────────────────

export async function ingestRepository(
  repoId: string,
  zipPath: string,
): Promise<IngestionResult> {
  const startTime = Date.now();
  const extractDir = path.join(UPLOADS_DIR, repoId);

  // Clean up any previous extraction
  if (existsSync(extractDir)) {
    rmSync(extractDir, { recursive: true, force: true });
  }

  // Mark repo as processing
  dbRun('UPDATE repositories SET status = ?, updated_at = ? WHERE id = ?', [
    'processing', now(), repoId,
  ]);

  try {
    // 1. Extract ZIP
    extractZipSync(zipPath, extractDir);

    // 2. Find actual repo root (handles single-folder ZIPs)
    const repoRoot = findRepoRoot(extractDir);

    // 3. Walk and scan files
    const scannedFiles: ScannedFile[] = [];
    walkDir(repoRoot, repoRoot, scannedFiles);

    // 4. Detect framework (look at package.json in repo root)
    const framework = detectFramework(repoRoot);

    // 5. Aggregate stats
    const langCounts: Record<string, number> = {};
    let sourceFiles = 0, testFiles = 0, configFiles = 0;
    let styleFiles = 0, assetFiles = 0, otherFiles = 0;
    let totalSize = 0;
    const topLevelDirsSet = new Set<string>();

    for (const f of scannedFiles) {
      totalSize += f.size;
      if (f.language) langCounts[f.language] = (langCounts[f.language] ?? 0) + 1;

      const topDir = f.relativePath.split('/')[0];
      if (f.relativePath.includes('/')) topLevelDirsSet.add(topDir);

      switch (f.type) {
        case 'source': sourceFiles++; break;
        case 'test':   testFiles++;   break;
        case 'config': configFiles++; break;
        case 'style':  styleFiles++;  break;
        case 'asset':  assetFiles++;  break;
        default:       otherFiles++;  break;
      }
    }

    const totalFiles = scannedFiles.length;
    const languages: LanguageStat[] = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({
        language,
        fileCount: count,
        percentage: totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0,
      }));

    const topLevelDirs = [...topLevelDirsSet].sort();
    const languageNames = languages.map((l) => l.language);

    // 6. Assign file IDs upfront so they can be referenced during dep parsing
    const pathToId = new Map<string, string>();
    for (const f of scannedFiles) {
      pathToId.set(f.relativePath, generateId('file'));
    }

    // 7. Extract symbols from parseable source files
    const pathToSymbols = new Map<string, string>();
    for (const f of scannedFiles) {
      if (PARSEABLE_EXTS.has(f.extension)) {
        const symbols = extractSymbols(f.absolutePath, f.extension);
        pathToSymbols.set(f.relativePath, JSON.stringify(symbols));
      }
    }

    // 8. Parse imports from TS/JS source files and resolve dependencies
    interface DepRow {
      id: string;
      sourceFileId: string;
      targetFileId: string | null;
      targetModule: string | null;
      importType: string;
    }
    const depRows: DepRow[] = [];
    const depSeen = new Set<string>(); // dedup: sourceId+targetId

    for (const f of scannedFiles) {
      if (!PARSEABLE_EXTS.has(f.extension)) continue;

      const sourceFileId = pathToId.get(f.relativePath)!;
      const imports = parseImports(f.absolutePath);

      for (const imp of imports) {
        if (isRelativeImport(imp.specifier)) {
          const resolvedAbs = resolveImport(f.absolutePath, imp.specifier);
          if (resolvedAbs) {
            const relPath = path.relative(repoRoot, resolvedAbs).replace(/\\/g, '/');
            const targetFileId = pathToId.get(relPath);
            if (targetFileId) {
              const key = `${sourceFileId}>${targetFileId}`;
              if (!depSeen.has(key)) {
                depSeen.add(key);
                depRows.push({
                  id: generateId('dep'),
                  sourceFileId,
                  targetFileId,
                  targetModule: null,
                  importType: imp.importType,
                });
              }
            }
          }
        } else if (!imp.specifier.startsWith('.')) {
          const pkgName = extractPackageName(imp.specifier);
          const key = `${sourceFileId}>${pkgName}`;
          if (!depSeen.has(key)) {
            depSeen.add(key);
            depRows.push({
              id: generateId('dep'),
              sourceFileId,
              targetFileId: null,
              targetModule: pkgName,
              importType: imp.importType,
            });
          }
        }
      }
    }

    // 9. Store everything in DB in one transaction
    dbTransaction(() => {
      // Delete previous records for this repo
      dbRunBatch('DELETE FROM files WHERE repo_id = ?', [repoId]);
      dbRunBatch('DELETE FROM dependencies WHERE repo_id = ?', [repoId]);

      // Insert all files (using pre-generated IDs)
      const insertFile = `INSERT INTO files
        (id, repo_id, path, name, extension, size, type, language, line_count, symbols, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const f of scannedFiles) {
        dbRunBatch(insertFile, [
          pathToId.get(f.relativePath)!,
          repoId,
          f.relativePath,
          f.name,
          f.extension || null,
          f.size,
          f.type,
          f.language ?? null,
          f.lineCount,
          pathToSymbols.get(f.relativePath) ?? '{}',
          now(),
        ]);
      }

      // Insert dependencies
      const insertDep = `INSERT INTO dependencies
        (id, repo_id, source_file_id, target_file_id, target_module, import_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      for (const d of depRows) {
        dbRunBatch(insertDep, [
          d.id, repoId, d.sourceFileId, d.targetFileId, d.targetModule, d.importType, now(),
        ]);
      }

      // Update repository metadata
      dbRunBatch(
        `UPDATE repositories SET
          status = 'ready',
          file_count = ?,
          total_size = ?,
          languages = ?,
          framework = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          totalFiles,
          totalSize,
          JSON.stringify(languageNames),
          framework ?? null,
          now(),
          repoId,
        ],
      );
    });

    invalidateAnalysis(repoId);

    return {
      repoId,
      fileCount: totalFiles,
      sourceFiles,
      testFiles,
      configFiles,
      styleFiles,
      assetFiles,
      otherFiles,
      totalSize,
      languages,
      framework,
      topLevelDirs,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (err) {
    dbRun('UPDATE repositories SET status = ?, updated_at = ? WHERE id = ?', [
      'error', now(), repoId,
    ]);
    throw err;
  }
}
