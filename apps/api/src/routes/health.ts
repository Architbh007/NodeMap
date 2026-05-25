import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@nodemap/types';

const START_TIME = Date.now();

const health: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: HealthResponse }>('/health', async () => {
    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
    };
  });
};

export default health;
