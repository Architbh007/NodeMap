import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ApiResponse, AiRepoBrief, AiNodeExplain, AiStatus } from '@nodemap/types';
import {
  generateRepoBrief,
  explainNode,
  getAiStatus,
} from '../ai/aiService.js';

const ExplainBody = z.object({
  nodeId: z.string().min(1),
  refresh: z.boolean().optional(),
});

const BriefQuery = z.object({
  refresh: z.enum(['true', 'false']).optional(),
});

const ai: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ApiResponse<AiStatus> }>(
    '/ai/status',
    async () => ({ success: true, data: getAiStatus() }),
  );

  fastify.get<{ Params: { id: string }; Reply: ApiResponse<AiStatus> }>(
    '/repositories/:id/ai/status',
    async () => ({ success: true, data: getAiStatus() }),
  );

  fastify.get<{
    Params: { id: string };
    Querystring: { refresh?: string };
    Reply: ApiResponse<AiRepoBrief>;
  }>('/repositories/:id/ai/brief', async (request, reply) => {
    if (!getAiStatus().configured) {
      reply.status(503);
      return { success: false, error: 'AI provider is not configured. Set one in Settings.' };
    }

    const query = BriefQuery.safeParse(request.query);
    const refresh = query.success && query.data.refresh === 'true';

    try {
      const brief = await generateRepoBrief(request.params.id, refresh);
      return { success: true, data: brief };
    } catch (err) {
      fastify.log.error(err, 'AI brief generation failed');
      reply.status(500);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'AI brief generation failed',
      };
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof ExplainBody>;
    Reply: ApiResponse<AiNodeExplain>;
  }>('/repositories/:id/ai/explain', async (request, reply) => {
    if (!getAiStatus().configured) {
      reply.status(503);
      return { success: false, error: 'AI provider is not configured. Set one in Settings.' };
    }

    const body = ExplainBody.safeParse(request.body);
    if (!body.success) {
      reply.status(400);
      return { success: false, error: 'nodeId is required' };
    }

    try {
      const explain = await explainNode(
        request.params.id,
        body.data.nodeId,
        body.data.refresh ?? false,
      );
      return { success: true, data: explain };
    } catch (err) {
      fastify.log.error(err, 'AI explain failed');
      reply.status(500);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'AI explain failed',
      };
    }
  });
};

export default ai;
