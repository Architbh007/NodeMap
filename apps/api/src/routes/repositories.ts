import { rmSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Repository, ApiResponse, PaginatedResponse } from '@nodemap/types';
import { dbAll, dbGet, dbRun } from '../storage/db.js';
import { generateId, now } from '../utils/id.js';
import type { RepositoryRow } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

function rowToRepo(row: RepositoryRow): Repository {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Repository['status'],
    uploadPath: row.upload_path ?? undefined,
    fileCount: row.file_count,
    totalSize: row.total_size,
    languages: JSON.parse(row.languages) as string[],
    framework: row.framework ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CreateRepoSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
});

const repositories: FastifyPluginAsync = async (fastify) => {
  // List repositories
  fastify.get<{ Reply: ApiResponse<PaginatedResponse<Repository>> }>(
    '/repositories',
    async (request) => {
      const query = request.query as { page?: string; pageSize?: string };
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
      const offset = (page - 1) * pageSize;

      const rows = dbAll<RepositoryRow>(
        'SELECT * FROM repositories ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset],
      );
      const total = (dbGet<{ count: number }>('SELECT COUNT(*) as count FROM repositories')?.count) ?? 0;

      return {
        success: true,
        data: {
          items: rows.map(rowToRepo),
          total,
          page,
          pageSize,
          hasMore: offset + pageSize < total,
        },
      };
    },
  );

  // Get single repository
  fastify.get<{ Params: { id: string }; Reply: ApiResponse<Repository> }>(
    '/repositories/:id',
    async (request, reply) => {
      const row = dbGet<RepositoryRow>('SELECT * FROM repositories WHERE id = ?', [request.params.id]);
      if (!row) {
        reply.status(404);
        return { success: false, error: 'Repository not found' };
      }
      return { success: true, data: rowToRepo(row) };
    },
  );

  // Create repository
  fastify.post<{ Reply: ApiResponse<Repository> }>(
    '/repositories',
    async (request, reply) => {
      const parsed = CreateRepoSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { success: false, error: parsed.error.message };
      }

      const { name, description } = parsed.data;
      const id = generateId('repo');
      const ts = now();

      dbRun(
        `INSERT INTO repositories (id, name, description, status, file_count, total_size, languages, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', 0, 0, '[]', ?, ?)`,
        [id, name, description ?? null, ts, ts],
      );

      const row = dbGet<RepositoryRow>('SELECT * FROM repositories WHERE id = ?', [id])!;
      reply.status(201);
      return { success: true, data: rowToRepo(row), message: 'Repository created' };
    },
  );

  // Delete repository (also cleans up uploaded files from disk)
  fastify.delete<{ Params: { id: string }; Reply: ApiResponse<null> }>(
    '/repositories/:id',
    async (request, reply) => {
      const row = dbGet<RepositoryRow>('SELECT id FROM repositories WHERE id = ?', [request.params.id]);
      if (!row) {
        reply.status(404);
        return { success: false, error: 'Repository not found' };
      }

      // Clean up extracted files from disk
      const uploadsPath = path.join(UPLOADS_DIR, request.params.id);
      if (existsSync(uploadsPath)) {
        try { rmSync(uploadsPath, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      dbRun('DELETE FROM repositories WHERE id = ?', [request.params.id]);
      return { success: true, data: null, message: 'Repository deleted' };
    },
  );

  // Update repository status (internal use)
  fastify.patch<{ Params: { id: string }; Reply: ApiResponse<Repository> }>(
    '/repositories/:id/status',
    async (request, reply) => {
      const body = request.body as { status: Repository['status'] };
      const valid = ['pending', 'processing', 'ready', 'error'];
      if (!valid.includes(body.status)) {
        reply.status(400);
        return { success: false, error: 'Invalid status' };
      }

      dbRun('UPDATE repositories SET status = ?, updated_at = ? WHERE id = ?', [
        body.status,
        now(),
        request.params.id,
      ]);

      const row = dbGet<RepositoryRow>('SELECT * FROM repositories WHERE id = ?', [request.params.id]);
      if (!row) {
        reply.status(404);
        return { success: false, error: 'Repository not found' };
      }
      return { success: true, data: rowToRepo(row) };
    },
  );

  // Re-scan repository
  fastify.post<{ Params: { id: string }; Reply: ApiResponse<null> }>(
    '/repositories/:id/rescan',
    async (request, reply) => {
      const row = dbGet<RepositoryRow>('SELECT id FROM repositories WHERE id = ?', [request.params.id]);
      if (!row) {
        reply.status(404);
        return { success: false, error: 'Repository not found' };
      }
      // Full re-scan requires re-uploading. Return guidance.
      reply.status(501);
      return {
        success: false,
        error: 'Re-scan: delete this repository and re-upload to refresh the analysis.',
      };
    },
  );
};

export default repositories;
