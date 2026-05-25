import { existsSync } from 'fs';
import path from 'path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INDEX_FILES = EXTENSIONS.map((ext) => `index${ext}`);

export function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Resolves a relative import specifier to an absolute file path.
 * Returns null if the specifier is an external module or cannot be resolved.
 */
export function resolveImport(
  sourceAbsPath: string,
  specifier: string,
): string | null {
  if (!isRelativeImport(specifier)) return null;

  const sourceDir = path.dirname(sourceAbsPath);
  const candidate = path.resolve(sourceDir, specifier);

  // If specifier already has a known extension and the file exists
  if (EXTENSIONS.some((ext) => specifier.endsWith(ext))) {
    return existsSync(candidate) ? candidate : null;
  }

  // Try adding extensions
  for (const ext of EXTENSIONS) {
    const withExt = candidate + ext;
    if (existsSync(withExt)) return withExt;
  }

  // Try as directory with index file
  for (const indexFile of INDEX_FILES) {
    const indexPath = path.join(candidate, indexFile);
    if (existsSync(indexPath)) return indexPath;
  }

  return null;
}

/** Extracts the package name from an import specifier (handles scoped packages). */
export function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}
