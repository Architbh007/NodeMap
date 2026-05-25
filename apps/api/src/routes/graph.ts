import type { FastifyPluginAsync } from 'fastify';
import { dbGet, dbAll } from '../storage/db.js';
import type { ApiResponse, GraphData } from '@nodemap/types';
import type { RepositoryRow } from '../types/index.js';
import { buildGraph, type FileRow2 } from '../services/graphBuilder.js';
import type { DependencyRow } from '../types/index.js';

const graph: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<GraphData>;
  }>('/repositories/:id/graph', async (request, reply) => {
    const { id } = request.params;

    const repo = dbGet<RepositoryRow>('SELECT * FROM repositories WHERE id = ?', [id]);
    if (!repo) {
      reply.status(404);
      return { success: false, error: 'Repository not found' };
    }
    if (repo.status !== 'ready') {
      reply.status(409);
      return { success: false, error: `Repository is not ready (status: ${repo.status})` };
    }

    const files = dbAll<FileRow2>(
      'SELECT * FROM files WHERE repo_id = ? ORDER BY path',
      [id],
    );

    const deps = dbAll<DependencyRow>(
      'SELECT * FROM dependencies WHERE repo_id = ?',
      [id],
    );

    const languages: string[] = (() => {
      try { return JSON.parse(repo.languages) as string[]; } catch { return []; }
    })();

    const graphData = buildGraph(id, files, deps, repo.framework ?? null, languages);

    return { success: true, data: graphData };
  });
};

export default graph;
