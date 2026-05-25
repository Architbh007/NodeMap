import { loadEnvFile } from './utils/loadEnv.js';
loadEnvFile();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { dbReady, closeDb } from './storage/db.js';
import health from './routes/health.js';
import repositories from './routes/repositories.js';
import upload from './routes/upload.js';
import fromUrl from './routes/fromUrl.js';
import graph from './routes/graph.js';
import ai from './routes/ai.js';
import analysis from './routes/analysis.js';
import reports from './routes/reports.js';
import settings from './routes/settings.js';
import { MAX_ZIP_SIZE } from './utils/pathSecurity.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_DEV = process.env.NODE_ENV !== 'production';

await dbReady;

const fastify = Fastify({
  logger: IS_DEV
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : true,
  bodyLimit: MAX_ZIP_SIZE,
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await fastify.register(multipart, {
  limits: { fileSize: MAX_ZIP_SIZE, files: 1 },
});

fastify.register(async (app) => {
  app.register(health);
  app.register(repositories);
  app.register(upload);
  app.register(fromUrl);
  app.register(graph);
  app.register(ai);
  app.register(analysis);
  app.register(reports);
  app.register(settings);
}, { prefix: '/api' });

const shutdown = async () => {
  await fastify.close();
  closeDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n  NodeMap API  →  http://localhost:${PORT}/api/health\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
