import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ApiResponse, ReportFormat, ReportSection } from '@nodemap/types';
import { getOrBuildAnalysis } from '../analysis/analysisCache.js';
import { generateReport } from '../analysis/reports/reportGenerator.js';

const REPORT_SECTIONS = [
  'overview', 'architecture', 'endpoints', 'dependencies',
  'risk', 'circular', 'deadcode', 'recommendations',
] as const;

const ReportSchema = z.object({
  format: z.enum(['markdown', 'json']).default('markdown'),
  sections: z.array(z.enum(REPORT_SECTIONS)).default(['overview', 'architecture', 'endpoints', 'risk', 'circular', 'deadcode', 'recommendations']),
});

const reports: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/repositories/:id/report',
    async (request, reply) => {
      const parsed = ReportSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { success: false, error: parsed.error.message } satisfies ApiResponse<null>;
      }
      const { format, sections } = parsed.data;
      try {
        const analysis = getOrBuildAnalysis(request.params.id);
        const r = generateReport(
          analysis,
          sections as ReportSection[],
          format as ReportFormat,
        );
        reply.header('Content-Type', r.contentType);
        reply.header('Content-Disposition', `attachment; filename="${r.filename}"`);
        return r.content;
      } catch (err) {
        fastify.log.error(err, 'report generation failed');
        reply.status(500);
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' } satisfies ApiResponse<null>;
      }
    },
  );
};

export default reports;
