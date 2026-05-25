import { readFileSync } from 'fs';
import type { ImportType } from '@nodemap/types';

export interface ParsedImport {
  specifier: string;
  importType: ImportType;
}

// ESM: import [type] BINDING from 'SPECIFIER'  (handles multi-line bindings)
const RE_IMPORT_DECL = /\bimport\s+(?:type\s+)?([\s\S]+?)\s+from\s+['"]([^'"]+)['"]/g;
// Side-effect: import 'SPECIFIER'
const RE_IMPORT_SIDE = /\bimport\s+['"]([^'"]+)['"]/g;
// Re-exports: export [type] { ... } from '...' or export * [as x] from '...'
const RE_EXPORT_FROM = /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;
// Dynamic: import('...')
const RE_DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
// CommonJS: require('...')
const RE_REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function detectImportType(binding: string): ImportType {
  const b = binding.trim();
  if (!b) return 'side-effect';
  if (b.startsWith('* ') || b === '*') return 'namespace';
  if (b.startsWith('{')) return 'named';
  return 'default';
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/\/\/[^\n]*/g, '');           // line comments
}

export function parseImports(filePath: string): ParsedImport[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const stripped = stripComments(content);
  const results: ParsedImport[] = [];
  const seen = new Set<string>();

  function add(specifier: string, type: ImportType) {
    if (specifier && !seen.has(specifier)) {
      seen.add(specifier);
      results.push({ specifier, importType: type });
    }
  }

  let m: RegExpExecArray | null;

  RE_IMPORT_DECL.lastIndex = 0;
  while ((m = RE_IMPORT_DECL.exec(stripped)) !== null) {
    add(m[2], detectImportType(m[1]));
  }

  // Side-effect imports — only when no 'from' binding precedes the quote
  RE_IMPORT_SIDE.lastIndex = 0;
  while ((m = RE_IMPORT_SIDE.exec(stripped)) !== null) {
    add(m[1], 'side-effect');
  }

  RE_EXPORT_FROM.lastIndex = 0;
  while ((m = RE_EXPORT_FROM.exec(stripped)) !== null) {
    const isNamed = m[0].includes('{');
    add(m[1], isNamed ? 'named' : 'namespace');
  }

  RE_DYNAMIC.lastIndex = 0;
  while ((m = RE_DYNAMIC.exec(stripped)) !== null) {
    add(m[1], 'dynamic');
  }

  RE_REQUIRE.lastIndex = 0;
  while ((m = RE_REQUIRE.exec(stripped)) !== null) {
    add(m[1], 'named');
  }

  return results;
}
