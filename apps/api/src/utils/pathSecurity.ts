import path from 'path';
import { readFileSync } from 'fs';

/**
 * Prevents zip-slip attacks.
 * Returns the safe absolute path, or throws if the resolved path escapes basePath.
 */
export function safePath(basePath: string, entryName: string): string {
  // Normalise to forward slashes, strip leading slashes/dots
  const sanitised = entryName
    .replace(/\\/g, '/')
    .replace(/^(\.\.\/|\.\/|\/)+/, '');

  const resolved = path.resolve(basePath, sanitised);

  if (!resolved.startsWith(path.resolve(basePath) + path.sep) &&
      resolved !== path.resolve(basePath)) {
    throw new Error(`Path traversal detected: ${entryName}`);
  }

  return resolved;
}

// Extensions that are definitely binary (never parse these as text)
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif', '.tiff',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
  // Binaries
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a',
  // Media
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mov', '.wmv', '.flv',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // DB / compiled
  '.db', '.sqlite', '.pyc', '.class', '.jar',
  // Lock files / generated
  '.lock',
  // Map files
  '.map',
]);

export function isBinaryExtension(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Checks first 512 bytes for null bytes — reliable binary detection.
 */
export function hasBinaryContent(filePath: string): boolean {
  try {
    const buf = readFileSync(filePath, { flag: 'r' });
    const slice = buf.subarray(0, 512);
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Directories to completely ignore during scanning
export const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '.nyc_output', '__pycache__',
  '.pytest_cache', 'target', 'vendor',
  '.cache', '.parcel-cache', '.turbo',
  '.venv', 'venv', 'env',
  '.gradle', '.mvn',
  'obj', 'bin',                  // .NET
  'Pods',                        // iOS
  '.DS_Store', 'thumbs.db',
]);

// Files to ignore regardless of directory
export const IGNORED_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '.gitkeep', '.gitattributes',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'bun.lockb', 'composer.lock', 'Gemfile.lock',
  'poetry.lock', 'Pipfile.lock',
]);

export const MAX_FILE_SIZE = 5 * 1024 * 1024;   // 5 MB per file
export const MAX_FILE_COUNT = 50_000;
export const MAX_ZIP_SIZE  = 100 * 1024 * 1024; // 100 MB
