import type {
  Repository,
  CreateRepositoryInput,
  ApiResponse,
  PaginatedResponse,
  HealthResponse,
  GraphData,
  IngestionResult,
  AiStatus,
  AiRepoBrief,
  AiNodeExplain,
  RepoAnalysis,
  EndpointFlow,
  ImpactResult,
  PrImpactResult,
  AppSettings,
  UpdateSettingsInput,
  ReportFormat,
  ReportSection,
} from '@nodemap/types';

const BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : `${res.status} ${res.statusText}`);
  }
  if (!res.ok) {
    throw new Error(json.error ?? `${res.status} ${res.statusText}`);
  }
  return json;
}

// ─── Health ──────────────────────────────────────────────
export const healthApi = {
  check: () => request<HealthResponse>('/health'),
};

// ─── Repositories ─────────────────────────────────────────
export const repoApi = {
  list: (page = 1, pageSize = 20) =>
    request<PaginatedResponse<Repository>>(`/repositories?page=${page}&pageSize=${pageSize}`),

  get: (id: string) =>
    request<Repository>(`/repositories/${id}`),

  create: (body: CreateRepositoryInput) =>
    request<Repository>('/repositories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<null>(`/repositories/${id}`, { method: 'DELETE' }),

  rescan: (id: string) =>
    request<null>(`/repositories/${id}/rescan`, { method: 'POST' }),

  updateStatus: (id: string, status: Repository['status']) =>
    request<Repository>(`/repositories/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  upload: (id: string, file: File, onProgress?: (pct: number) => void): Promise<ApiResponse<IngestionResult>> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText) as ApiResponse<IngestionResult>;
          resolve(json);
        } catch {
          reject(new Error('Invalid server response'));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', `${BASE}/repositories/${id}/upload`);
      xhr.send(form);
    });
  },
};

// ─── From URL ─────────────────────────────────────────────
export interface FromUrlInput {
  url: string;
  name?: string;
  description?: string;
  branch?: string;
  token?: string;
}

export interface UrlPreview {
  provider: string;
  owner: string;
  repo: string;
  suggestedName: string;
}

export const fromUrlApi = {
  analyze: (body: FromUrlInput) =>
    request<IngestionResult & { repoName: string }>('/repositories/from-url', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  preview: (url: string) =>
    request<UrlPreview>('/repositories/preview-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
};

// ─── Graph ────────────────────────────────────────────────
export const graphApi = {
  get: (repoId: string) =>
    request<GraphData>(`/repositories/${repoId}/graph`),
};

// ─── AI ───────────────────────────────────────────────────
export const aiApi = {
  status: () => request<AiStatus>(`/ai/status`),

  briefRepo: (repoId: string, refresh = false) =>
    request<AiRepoBrief>(`/repositories/${repoId}/ai/brief${refresh ? '?refresh=true' : ''}`),

  explain: (repoId: string, nodeId: string, refresh = false) =>
    request<AiNodeExplain>(`/repositories/${repoId}/ai/explain`, {
      method: 'POST',
      body: JSON.stringify({ nodeId, refresh }),
    }),
};

// ─── Analysis ─────────────────────────────────────────────
export const analysisApi = {
  get: (repoId: string, refresh = false) =>
    request<RepoAnalysis>(`/repositories/${repoId}/analysis${refresh ? '?refresh=true' : ''}`),

  endpointFlow: (repoId: string, endpointId: string) =>
    request<EndpointFlow>(`/repositories/${repoId}/endpoint-flow?endpointId=${encodeURIComponent(endpointId)}`),

  impact: (repoId: string, fileId: string) =>
    request<ImpactResult>(`/repositories/${repoId}/impact?fileId=${encodeURIComponent(fileId)}`),

  prImpact: (repoId: string, changedFiles: string[]) =>
    request<PrImpactResult>(`/repositories/${repoId}/pr-impact`, {
      method: 'POST',
      body: JSON.stringify({ changedFiles }),
    }),
};

// ─── Reports ──────────────────────────────────────────────
export const reportsApi = {
  download: async (repoId: string, format: ReportFormat, sections: ReportSection[]): Promise<void> => {
    const res = await fetch(`${BASE}/repositories/${repoId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, sections }),
    });
    if (!res.ok) throw new Error(`Report download failed: ${res.status}`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const m = /filename="([^"]+)"/.exec(disposition);
    const filename = m?.[1] ?? `nodemap-report.${format === 'json' ? 'json' : 'md'}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── Settings ─────────────────────────────────────────────
export const settingsApi = {
  get: () => request<AppSettings>('/settings'),
  update: (body: UpdateSettingsInput) =>
    request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  testAi: () => request<{ ok: boolean; error?: string }>('/settings/ai/test', { method: 'POST' }),
};
