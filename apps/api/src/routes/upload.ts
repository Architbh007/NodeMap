import type { FastifyPluginAsync } from 'fastify';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbGet } from '../storage/db.js';
import { ingestRepository, UPLOADS_DIR } from '../services/ingestion.js';
import { MAX_ZIP_SIZE } from '../utils/pathSecurity.js';
import type { ApiResponse, IngestionResult } from '@nodemap/types';
import type { RepositoryRow } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.resolve(__dirname, '../../temp');

const upload: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Reply: ApiResponse<IngestionResult> }>(
    '/repositories/:id/upload',
    {
      config: { rawBody: false },
    },
    async (request, reply) => {
      const { id: repoId } = request.params;

      // Verify repo exists
      const repo = dbGet<RepositoryRow>('SELECT id, status FROM repositories WHERE id = ?', [repoId]);
      if (!repo) {
        reply.status(404);
        return { success: false, error: 'Repository not found' };
      }

      // Get uploaded file
      let data;
      try {
        data = await request.file({
          limits: { fileSize: MAX_ZIP_SIZE },
        });
      } catch (err) {
        reply.status(400);
        return { success: false, error: `Upload error: ${(err as Error).message}` };
      }

      if (!data) {
        reply.status(400);
        return { success: false, error: 'No file provided' };
      }

      // Validate it's a ZIP by filename
      if (!data.filename.toLowerCase().endsWith('.zip')) {
        reply.status(400);
        return { success: false, error: 'Only .zip files are accepted' };
      }

      // Save to temp file
      if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
      if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

      const tempZipPath = path.join(TEMP_DIR, `${repoId}.zip`);

      try {
        await pipeline(data.file, createWriteStream(tempZipPath));

        // Check actual magic bytes (PK\x03\x04 signature for ZIP)
        const header = readFileSync(tempZipPath).subarray(0, 4);
        if (header[0] !== 0x50 || header[1] !== 0x4B) {
          reply.status(400);
          return { success: false, error: 'File is not a valid ZIP archive' };
        }

        // Run ingestion
        const result = await ingestRepository(repoId, tempZipPath);
        return { success: true, data: result };

      } catch (err) {
        fastify.log.error(err, 'Ingestion failed');
        reply.status(500);
        return { success: false, error: `Analysis failed: ${(err as Error).message}` };
      } finally {
        // Clean up temp ZIP (extracted files stay for Phase 4)
        try { unlinkSync(tempZipPath); } catch { /* ignore */ }
      }
    },
  );
};

export default upload;
