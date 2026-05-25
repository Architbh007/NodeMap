import type { FastifyPluginAsync } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { z } from 'zod';
import { dbGet, dbRun } from '../storage/db.js';
import { generateId, now } from '../utils/id.js';
import { parseRepoUrl, downloadRepoArchive } from '../services/repoDownload.js';
import { ingestRepository, UPLOADS_DIR } from '../services/ingestion.js';
import type { ApiResponse, IngestionResult } from '@nodemap/types';
import type { RepositoryRow } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.resolve(__dirname, '../../temp');

const FromUrlSchema = z.object({
  url:         z.string().min(1, 'URL is required'),
  name:        z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  branch:      z.string().max(128).optional(),
  token:       z.string().optional(),
});

const fromUrl: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Reply: ApiResponse<IngestionResult & { repoName: string }> }>(
    '/repositories/from-url',
    async (request, reply) => {
      const parsed = FromUrlSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
      }

      const { url, name, description, branch, token } = parsed.data;

      // Parse + validate the URL
      let repoInfo;
      try {
        repoInfo = parseRepoUrl(url);
      } catch (err) {
        reply.status(400);
        return { success: false, error: (err as Error).message };
      }

      const repoName = name?.trim() || repoInfo.suggestedName;
      const repoId   = generateId('repo');
      const ts       = now();

      // Create repository record
      dbRun(
        `INSERT INTO repositories (id, name, description, status, file_count, total_size, languages, created_at, updated_at)
         VALUES (?, ?, ?, 'processing', 0, 0, '[]', ?, ?)`,
        [repoId, repoName, description?.trim() ?? null, ts, ts],
      );

      // Ensure directories exist
      if (!existsSync(TEMP_DIR))    mkdirSync(TEMP_DIR,    { recursive: true });
      if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

      const tempZipPath = path.join(TEMP_DIR, `${repoId}.zip`);

      try {
        fastify.log.info(`Downloading ${repoInfo.provider}/${repoInfo.owner}/${repoInfo.repo}…`);

        const { branch: detectedBranch, sizeBytes } = await downloadRepoArchive(
          repoInfo,
          tempZipPath,
          { branch, token },
        );

        fastify.log.info(
          `Downloaded ${(sizeBytes / 1024).toFixed(0)} KB (branch: ${detectedBranch}) — starting ingestion`,
        );

        const result = await ingestRepository(repoId, tempZipPath);

        // Persist the source URL and description
        const finalDesc = description?.trim() ||
          `${repoInfo.provider.charAt(0).toUpperCase() + repoInfo.provider.slice(1)}: ${repoInfo.owner}/${repoInfo.repo}`;

        const sourceUrl = url.trim();
        dbRun('UPDATE repositories SET description = ?, source_url = ? WHERE id = ?', [finalDesc, sourceUrl, repoId]);

        return {
          success: true,
          data: { ...result, repoName, repoId },
          message: `Analyzed ${result.fileCount} files from ${repoInfo.owner}/${repoInfo.repo}`,
        };

      } catch (err) {
        const message = (err as Error).message;
        fastify.log.error(err, 'from-url ingestion failed');

        dbRun('UPDATE repositories SET status = ?, updated_at = ? WHERE id = ?', [
          'error', now(), repoId,
        ]);

        reply.status(500);
        return { success: false, error: message };

      } finally {
        try { unlinkSync(tempZipPath); } catch { /* already gone */ }
      }
    },
  );

  // Lightweight URL preview — parse + validate without downloading
  fastify.post<{ Reply: ApiResponse<{ provider: string; owner: string; repo: string; suggestedName: string }> }>(
    '/repositories/preview-url',
    async (request, reply) => {
      const body = request.body as { url?: string };
      if (!body.url) {
        reply.status(400);
        return { success: false, error: 'URL is required' };
      }
      try {
        const info = parseRepoUrl(body.url);
        return {
          success: true,
          data: {
            provider: info.provider,
            owner: info.owner,
            repo: info.repo,
            suggestedName: info.suggestedName,
          },
        };
      } catch (err) {
        reply.status(400);
        return { success: false, error: (err as Error).message };
      }
    },
  );
};

export default fromUrl;
