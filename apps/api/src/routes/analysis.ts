import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  ApiResponse, RepoAnalysis, EndpointFlow, ImpactResult, PrImpactResult,
} from '@nodemap/types';
import { getOrBuildAnalysis, invalidateAnalysis } from '../analysis/analysisCache.js';
import { buildEndpointFlow } from '../analysis/endpoints/endpointFlow.js';
import { computeImpact } from '../analysis/impact/impactEngine.js';
import { buildPrImpactResult, buildPrImpactFromGithub } from '../analysis/impact/prImpactService.js';
import { loadRepoData } from '../analysis/repoAnalysis.js';
import { dbGet } from '../storage/db.js';
import type { RepositoryRow } from '../types/index.js';

const analysisRoutes: FastifyPluginAsync = async (fastify) => {
  // Unified analysis (cached)
  fastify.get<{
    Params: { id: string };
    Querystring: { refresh?: string };
    Reply: ApiResponse<RepoAnalysis>;
  }>('/repositories/:id/analysis', async (request, reply) => {
    const { id } = request.params;
    const refresh = request.query.refresh === 'true';
    try {
      const repo = dbGet<RepositoryRow>('SELECT id, status FROM repositories WHERE id = ?', [id]);
      if (!repo) { reply.status(404); return { success: false, error: 'Repository not found' }; }
      if (repo.status !== 'ready') {
        reply.status(409);
        return { success: false, error: `Repository is not ready (status: ${repo.status})` };
      }
      const analysis = getOrBuildAnalysis(id, refresh);
      return { success: true, data: analysis };
    } catch (err) {
      fastify.log.error(err, 'Analysis build failed');
      reply.status(500);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // Endpoint flow by endpoint id
  fastify.get<{
    Params: { id: string };
    Querystring: { endpointId?: string };
    Reply: ApiResponse<EndpointFlow>;
  }>('/repositories/:id/endpoint-flow', async (request, reply) => {
    const epId = request.query.endpointId;
    if (!epId) { reply.status(400); return { success: false, error: 'endpointId is required' }; }
    try {
      const analysis = getOrBuildAnalysis(request.params.id);
      const ep = analysis.endpoints.find((e) => e.id === epId);
      if (!ep) { reply.status(404); return { success: false, error: 'Endpoint not found' }; }
      return { success: true, data: buildEndpointFlow(ep) };
    } catch (err) {
      reply.status(500);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // Impact for a single file
  fastify.get<{
    Params: { id: string };
    Querystring: { fileId?: string };
    Reply: ApiResponse<ImpactResult>;
  }>('/repositories/:id/impact', async (request, reply) => {
    const fileId = request.query.fileId;
    if (!fileId) { reply.status(400); return { success: false, error: 'fileId is required' }; }
    try {
      const data = loadRepoData(request.params.id);
      const analysis = getOrBuildAnalysis(request.params.id);
      const result = computeImpact(fileId, {
        files: data.files,
        deps: data.deps,
        endpoints: analysis.endpoints,
      });
      return { success: true, data: result };
    } catch (err) {
      reply.status(500);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // PR impact (manual: client passes changed file paths)
  const PrImpactSchema = z.object({
    changedFiles: z.array(z.string().min(1)).min(1).max(500),
  });
  fastify.post<{
    Params: { id: string };
    Body: { changedFiles: string[] };
    Reply: ApiResponse<PrImpactResult>;
  }>('/repositories/:id/pr-impact', async (request, reply) => {
    const parsed = PrImpactSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { success: false, error: 'changedFiles[] required' };
    }
    try {
      const data = buildPrImpactResult(request.params.id, parsed.data.changedFiles);
      return { success: true, data };
    } catch (err) {
      reply.status(500);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  const PrImpactGithubSchema = z.object({
    prUrl: z.string().min(1).max(512),
  });
  fastify.post<{
    Params: { id: string };
    Body: { prUrl: string };
    Reply: ApiResponse<PrImpactResult>;
  }>('/repositories/:id/pr-impact/github', async (request, reply) => {
    const parsed = PrImpactGithubSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { success: false, error: 'prUrl is required' };
    }
    try {
      const data = await buildPrImpactFromGithub(request.params.id, parsed.data.prUrl.trim());
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('token') || message.includes('GitHub') ? 400 : 500;
      reply.status(status);
      return { success: false, error: message };
    }
  });

  // Invalidate analysis cache (called after ingestion)
  fastify.post<{ Params: { id: string }; Reply: ApiResponse<null> }>(
    '/repositories/:id/analysis/invalidate',
    async (request) => {
      invalidateAnalysis(request.params.id);
      return { success: true, data: null };
    },
  );
};

export default analysisRoutes;
