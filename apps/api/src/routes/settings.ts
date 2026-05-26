import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ApiResponse, AppSettings } from '@nodemap/types';
import { getSettings, updateSettings, getGithubToken } from '../storage/settingsStore.js';
import { testAiConnection } from '../ai/aiService.js';
import { testGithubConnection } from '../services/githubClient.js';

const UpdateSchema = z.object({
  ai: z.object({
    provider: z.enum(['openai', 'gemini', 'disabled']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
  ignoredPaths: z.array(z.string()).optional(),
  graph: z.object({
    showExternalModules: z.boolean().optional(),
    edgeAnimations: z.boolean().optional(),
  }).optional(),
  github: z.object({
    token: z.string().optional(),
  }).optional(),
});

const settings: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ApiResponse<AppSettings> }>(
    '/settings',
    async () => ({ success: true, data: getSettings() }),
  );

  fastify.put<{ Reply: ApiResponse<AppSettings> }>(
    '/settings',
    async (request, reply) => {
      const parsed = UpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return { success: false, error: msg || 'Invalid settings payload' };
      }
      const next = updateSettings(parsed.data);
      return { success: true, data: next };
    },
  );

  fastify.post<{ Reply: ApiResponse<{ ok: boolean; error?: string }> }>(
    '/settings/ai/test',
    async () => {
      const result = await testAiConnection();
      return { success: true, data: result };
    },
  );

  fastify.post<{ Reply: ApiResponse<{ ok: boolean; error?: string; login?: string }> }>(
    '/settings/github/test',
    async () => {
      const token = getGithubToken();
      if (!token) {
        return { success: true, data: { ok: false, error: 'No GitHub token configured' } };
      }
      const result = await testGithubConnection(token);
      return { success: true, data: result };
    },
  );
};

export default settings;
