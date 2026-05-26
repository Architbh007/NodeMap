import { parseRepoUrl } from './repoDownload.js';

export interface ParsedPullRequestUrl {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

export interface GitHubPullRequestFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  previousFilename?: string;
}

export interface GitHubPullRequestSummary {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  state: string;
  changedFiles: GitHubPullRequestFile[];
}

const PR_PATH = /\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/i;

export function parsePullRequestUrl(rawUrl: string): ParsedPullRequestUrl {
  let normalised = rawUrl.trim();
  if (!normalised.startsWith('http')) normalised = `https://${normalised}`;

  let url: URL;
  try {
    url = new URL(normalised);
  } catch {
    throw new Error(`Invalid pull request URL: "${rawUrl}"`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new Error('Only github.com pull request URLs are supported');
  }

  const path = url.pathname.replace(/\/files\/?$/, '');
  const m = PR_PATH.exec(path);
  if (!m) {
    throw new Error('Expected URL like https://github.com/owner/repo/pull/123');
  }

  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  const number = Number(m[3]);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error('Invalid pull request number');
  }

  return {
    owner,
    repo,
    number,
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
  };
}

/** Compare owner/repo from a PR URL with an ingested repository source URL. */
export function repoMatchesSource(
  pr: Pick<ParsedPullRequestUrl, 'owner' | 'repo'>,
  sourceUrl: string | null | undefined,
): boolean {
  if (!sourceUrl?.trim()) return true;
  try {
    const parsed = parseRepoUrl(sourceUrl);
    return (
      parsed.provider === 'github'
      && parsed.owner.toLowerCase() === pr.owner.toLowerCase()
      && parsed.repo.toLowerCase() === pr.repo.toLowerCase()
    );
  } catch {
    return true;
  }
}

async function githubFetch<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'NodeMap',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  const text = await res.text();

  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err.message) message = err.message;
    } catch { /* keep raw */ }

    if (res.status === 401) throw new Error('GitHub token is invalid or expired');
    if (res.status === 403 && message.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded — add a token in Settings');
    }
    if (res.status === 404) throw new Error('Pull request not found — check the URL and token scope');
    throw new Error(`GitHub API error (${res.status}): ${message}`);
  }

  return JSON.parse(text) as T;
}

export async function testGithubConnection(token: string): Promise<{ ok: boolean; error?: string; login?: string }> {
  if (!token.trim()) return { ok: false, error: 'GitHub token is empty' };
  try {
    const user = await githubFetch<{ login?: string }>('/user', token.trim());
    return { ok: true, login: user.login };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function fetchPullRequestSummary(
  prUrl: string,
  token?: string,
): Promise<GitHubPullRequestSummary> {
  const parsed = parsePullRequestUrl(prUrl);
  const auth = token?.trim() || undefined;

  const pr = await githubFetch<{
    title: string;
    html_url: string;
    state: string;
  }>(`/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`, auth);

  const changedFiles: GitHubPullRequestFile[] = [];
  let page = 1;

  while (page <= 10) {
    const batch = await githubFetch<Array<{
      filename: string;
      status: GitHubPullRequestFile['status'];
      previous_filename?: string;
    }>>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/files?per_page=100&page=${page}`,
      auth,
    );
    if (batch.length === 0) break;

    for (const f of batch) {
      changedFiles.push({
        filename: f.filename,
        status: f.status,
        previousFilename: f.previous_filename,
      });
    }

    if (batch.length < 100) break;
    page += 1;
  }

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    number: parsed.number,
    title: pr.title,
    url: pr.html_url || parsed.url,
    state: pr.state,
    changedFiles,
  };
}

/** Paths to analyze — modified/added/renamed/copied files (not pure deletions). */
export function prFilesToChangedPaths(files: GitHubPullRequestFile[]): string[] {
  const paths = new Set<string>();
  for (const f of files) {
    if (f.status === 'removed') continue;
    paths.add(f.filename.replace(/\\/g, '/'));
    if (f.previousFilename && f.status === 'renamed') {
      paths.add(f.previousFilename.replace(/\\/g, '/'));
    }
  }
  return [...paths];
}
