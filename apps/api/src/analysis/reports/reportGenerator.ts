import type { RepoAnalysis, ReportFormat, ReportSection } from '@nodemap/types';

/**
 * Report Generator
 * Produces JSON or Markdown reports from the unified RepoAnalysis.
 */

export function generateReport(
  analysis: RepoAnalysis,
  sections: ReportSection[],
  format: ReportFormat,
): { content: string; filename: string; contentType: string } {
  if (format === 'json') {
    const filtered = filterAnalysis(analysis, sections);
    return {
      content: JSON.stringify(filtered, null, 2),
      filename: `nodemap-${analysis.repoName}-report.json`,
      contentType: 'application/json',
    };
  }

  const md = renderMarkdown(analysis, sections);
  return {
    content: md,
    filename: `nodemap-${analysis.repoName}-report.md`,
    contentType: 'text/markdown',
  };
}

function filterAnalysis(a: RepoAnalysis, sections: ReportSection[]): Partial<RepoAnalysis> {
  const out: Partial<RepoAnalysis> = {
    repoId: a.repoId,
    repoName: a.repoName,
    framework: a.framework,
    languages: a.languages,
    fileCount: a.fileCount,
    healthScore: a.healthScore,
    generatedAt: a.generatedAt,
  };
  if (sections.includes('endpoints')) out.endpoints = a.endpoints;
  if (sections.includes('dependencies')) out.dependencies = a.dependencies;
  if (sections.includes('risk')) out.riskScores = a.riskScores;
  if (sections.includes('deadcode')) out.deadCodeCandidates = a.deadCodeCandidates;
  if (sections.includes('architecture')) {
    out.layers = a.layers;
    out.topConnected = a.topConnected;
  }
  return out;
}

function renderMarkdown(a: RepoAnalysis, sections: ReportSection[]): string {
  const lines: string[] = [];
  lines.push(`# NodeMap Report — ${a.repoName}`);
  lines.push(`*Generated: ${a.generatedAt}*`);
  lines.push('');

  if (sections.includes('overview')) {
    lines.push('## Overview');
    lines.push('');
    lines.push(`- Framework: **${a.framework ?? 'unknown'}**`);
    lines.push(`- Languages: ${a.languages.join(', ') || 'unknown'}`);
    lines.push(`- Files: **${a.fileCount}**`);
    lines.push(`- Folders: **${a.folderCount}**`);
    lines.push(`- Dependencies: ${a.dependencies.total} (${a.dependencies.internal} internal, ${a.dependencies.external} external)`);
    lines.push(`- Endpoints detected: **${a.endpoints.length}**`);
    lines.push(`- Circular dependencies: **${a.dependencies.circular.length}**`);
    lines.push(`- Dead code candidates: **${a.deadCodeCandidates.length}**`);
    lines.push(`- Health score: **${a.healthScore}/100**`);
    lines.push('');
  }

  if (sections.includes('architecture')) {
    lines.push('## Architecture Overview');
    lines.push('');
    const counts = new Map<string, number>();
    for (const l of a.layers) counts.set(l.layer, (counts.get(l.layer) ?? 0) + 1);
    lines.push('| Layer | Files |');
    lines.push('|-------|-------|');
    for (const [layer, count] of [...counts.entries()].sort((x, y) => y[1] - x[1])) {
      lines.push(`| ${layer} | ${count} |`);
    }
    lines.push('');
    if (a.topConnected.length) {
      lines.push('### Most Connected Files');
      lines.push('');
      lines.push('| File | Dependents | Risk |');
      lines.push('|------|------------|------|');
      for (const c of a.topConnected.slice(0, 10)) {
        lines.push(`| \`${c.path}\` | ${c.connectionCount} | ${c.riskScore} |`);
      }
      lines.push('');
    }
  }

  if (sections.includes('endpoints') && a.endpoints.length) {
    lines.push('## Detected Endpoints');
    lines.push('');
    lines.push('| Method | Path | Route File | Handler |');
    lines.push('|--------|------|------------|---------|');
    for (const ep of a.endpoints.slice(0, 100)) {
      lines.push(`| ${ep.method} | \`${ep.path}\` | \`${ep.routeFile}\` | ${ep.handler ?? '—'} |`);
    }
    lines.push('');
  }

  if (sections.includes('dependencies')) {
    lines.push('## Dependency Insights');
    lines.push('');
    lines.push(`Total: **${a.dependencies.total}**`);
    lines.push(`- Internal: ${a.dependencies.internal}`);
    lines.push(`- External: ${a.dependencies.external}`);
    lines.push('');
  }

  if (sections.includes('risk') && a.riskScores.length) {
    lines.push('## Risk Map');
    lines.push('');
    lines.push('| File | Score | Level | Reasons |');
    lines.push('|------|-------|-------|---------|');
    for (const r of a.riskScores.slice(0, 30)) {
      lines.push(`| \`${r.path}\` | ${r.score} | **${r.level}** | ${r.reasons.join('; ')} |`);
    }
    lines.push('');
  }

  if (sections.includes('circular') && a.dependencies.circular.length) {
    lines.push('## Circular Dependencies');
    lines.push('');
    a.dependencies.circular.forEach((group, i) => {
      lines.push(`### Cycle ${i + 1}`);
      lines.push('');
      const paths = group.map((id) => {
        const l = a.layers.find((x) => x.fileId === id);
        return `- \`${l?.path ?? id}\``;
      });
      lines.push(...paths);
      lines.push('');
    });
  }

  if (sections.includes('deadcode') && a.deadCodeCandidates.length) {
    lines.push('## Dead Code Candidates');
    lines.push('');
    lines.push('| File | Confidence | Reasons |');
    lines.push('|------|------------|---------|');
    for (const c of a.deadCodeCandidates.slice(0, 50)) {
      lines.push(`| \`${c.path}\` | ${c.confidence} | ${c.reasons.join('; ')} |`);
    }
    lines.push('');
  }

  if (sections.includes('recommendations')) {
    lines.push('## Recommendations');
    lines.push('');
    if (a.dependencies.circular.length > 0) {
      lines.push(`- 🔁 **Break ${a.dependencies.circular.length} circular dependency group(s).** Cycles make refactors brittle.`);
    }
    if (a.highRiskCount > 0) {
      lines.push(`- 🔥 Investigate the top ${Math.min(5, a.highRiskCount)} high-risk files — they sit on many dependency paths.`);
    }
    if (a.deadCodeCandidates.length > 0) {
      const high = a.deadCodeCandidates.filter((c) => c.confidence === 'high').length;
      if (high > 0) lines.push(`- 🧹 Verify ${high} high-confidence dead-code candidate(s) and remove if truly unused.`);
    }
    if (a.healthScore < 60) {
      lines.push(`- ⚠️ Health score is **${a.healthScore}/100**. Focus on the items above to improve architecture quality.`);
    }
    if (lines[lines.length - 1] === '## Recommendations') {
      lines.push('- ✅ Codebase looks healthy. Keep an eye on growing high-risk files.');
    }
    lines.push('');
  }

  return lines.join('\n');
}
