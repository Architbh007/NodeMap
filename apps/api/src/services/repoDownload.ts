import https from 'https';
import http from 'http';
import { createWriteStream, unlinkSync, existsSync } from 'fs';
import { mkdirSync } from 'fs';
import path from 'path';

// ─── URL parsing ──────────────────────────────────────────

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

export interface ParsedRepoUrl {
  provider: GitProvider;
  owner: string;
  repo: string;
  suggestedName: string;
  originalUrl: string;
}

export function parseRepoUrl(rawUrl: string): ParsedRepoUrl {
  let normalised = rawUrl.trim();
  if (!normalised.startsWith('http')) normalised = `https://${normalised}`;

  let url: URL;
  try {
    url = new URL(normalised);
  } catch {
    throw new Error(`Invalid URL: "${rawUrl}"`);
  }

  const hostname = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    if (parts.length < 2) throw new Error('GitHub URL must include owner and repo (e.g. github.com/owner/repo)');
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    return { provider: 'github', owner, repo, suggestedName: repo, originalUrl: rawUrl };
  }

  if (hostname === 'gitlab.com' || hostname === 'www.gitlab.com') {
    if (parts.length < 2) throw new Error('GitLab URL must include owner and repo');
    const repo = parts[parts.length - 1].replace(/\.git$/, '');
    const owner = parts.slice(0, -1).join('/');
    return { provider: 'gitlab', owner, repo, suggestedName: repo, originalUrl: rawUrl };
  }

  if (hostname === 'bitbucket.org' || hostname === 'www.bitbucket.org') {
    if (parts.length < 2) throw new Error('Bitbucket URL must include owner and repo');
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    return { provider: 'bitbucket', owner, repo, suggestedName: repo, originalUrl: rawUrl };
  }

  throw new Error(
    `Unsupported host "${hostname}". Supported providers: GitHub, GitLab, Bitbucket.`,
  );
}

// ─── Download URL builder ─────────────────────────────────

// Using HEAD alias so we always get the default branch without needing to know its name.
function buildArchiveUrl(parsed: ParsedRepoUrl, branch: string, token?: string): string {
  const { provider, owner, repo } = parsed;
  switch (provider) {
    case 'github':
      // HEAD resolves to the repo's default branch
      return `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    case 'gitlab':
      return `https://gitlab.com/${owner}/${repo}/-/archive/${branch}/${repo}-${branch}.zip`;
    case 'bitbucket':
      return `https://bitbucket.org/${owner}/${repo}/get/${branch}.zip`;
  }
}

// ─── HTTP download with redirect following ────────────────

const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function downloadUrl(
  url: string,
  destPath: string,
  headers: Record<string, string> = {},
  redirectsLeft = MAX_REDIRECTS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const dir = path.dirname(destPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const req = client.get(url, { headers, timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)
          && res.headers.location) {
        if (redirectsLeft === 0) { reject(new Error('Too many redirects')); return; }
        res.resume();
        downloadUrl(res.headers.location, destPath, headers, redirectsLeft - 1)
          .then(resolve).catch(reject);
        return;
      }

      if (res.statusCode === 404) {
        reject(new Error('Repository not found — check the URL and make sure the repo is public'));
        return;
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        reject(new Error('Access denied — this may be a private repo. Provide a personal access token.'));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Server returned HTTP ${res.statusCode}`));
        return;
      }

      const file = createWriteStream(destPath);
      let bytesWritten = 0;

      res.on('data', (chunk: Buffer) => { bytesWritten += chunk.length; });
      res.pipe(file);

      file.on('finish', () => file.close(() => resolve(bytesWritten)));
      file.on('error', (err) => { try { unlinkSync(destPath); } catch { /* ignore */ } reject(err); });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out (5 min limit)')); });
    req.on('error', reject);
  });
}

// ─── Public entry point ───────────────────────────────────

export interface DownloadOptions {
  branch?: string;
  token?: string;
}

/**
 * Downloads a repository archive to destPath.
 * Tries `main` first, then `master` if the first attempt returns 404.
 */
export async function downloadRepoArchive(
  parsed: ParsedRepoUrl,
  destPath: string,
  options: DownloadOptions = {},
): Promise<{ branch: string; sizeBytes: number }> {
  const { token } = options;
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  // If an explicit branch was provided, use it directly
  if (options.branch) {
    const url = buildArchiveUrl(parsed, options.branch, token);
    const sizeBytes = await downloadUrl(url, destPath, headers);
    return { branch: options.branch, sizeBytes };
  }

  // Auto-detect: try main → master
  const candidates = ['main', 'master'];
  let lastErr: Error = new Error('Unknown error');

  for (const branch of candidates) {
    const url = buildArchiveUrl(parsed, branch, token);
    try {
      const sizeBytes = await downloadUrl(url, destPath, headers);
      return { branch, sizeBytes };
    } catch (err) {
      lastErr = err as Error;
      // Only continue if the error is a 404 — other errors (auth, network) should bubble
      if (!lastErr.message.includes('not found') && !lastErr.message.includes('HTTP 404')) {
        throw lastErr;
      }
      // Try next branch
    }
  }

  throw lastErr;
}
