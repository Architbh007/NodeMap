import { loadEnvFile } from './utils/loadEnv.js';
loadEnvFile();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticServe from '@fastify/static';
import path from 'path';
import { existsSync } from 'fs';
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

// In production the Vite build is copied to <cwd>/public by the Dockerfile.
const STATIC_DIR = process.env.STATIC_DIR ?? path.join(process.cwd(), 'public');
const SERVE_STATIC = !IS_DEV && existsSync(STATIC_DIR);

await dbReady;

const fastify = Fastify({
  logger: IS_DEV
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : true,
  bodyLimit: MAX_ZIP_SIZE,
});

// In dev, CORS allows the Vite dev server. In production, requests are same-origin so CORS is a no-op.
await fastify.register(cors, {
  origin: IS_DEV ? (process.env.CORS_ORIGIN ?? 'http://localhost:5173') : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await fastify.register(multipart, {
  limits: { fileSize: MAX_ZIP_SIZE, files: 1 },
});

// Serve built frontend (production only)
if (SERVE_STATIC) {
  await fastify.register(staticServe, {
    root: STATIC_DIR,
    prefix: '/',
    // Don't throw when /api/* misses — let route handlers answer those
    wildcard: false,
  });
}

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

// SPA fallback — any non-/api GET that doesn't match a static file serves index.html
if (SERVE_STATIC) {
  fastify.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html', STATIC_DIR);
  });
}

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
