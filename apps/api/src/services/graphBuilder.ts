import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphMetadata,
  NodeType,
  FileType,
  ImportType,
  DependencyRef,
  FunctionInfo,
  ClassInfo,
} from '@nodemap/types';
import type { FileRow, DependencyRow } from '../types/index.js';

export interface FileRow2 extends FileRow {
  type: FileType;
}

function detectCircularNodes(adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const circular = new Set<string>();

  function dfs(id: string, path: string[]): void {
    if (inStack.has(id)) {
      const start = path.indexOf(id);
      for (let i = start; i < path.length; i++) circular.add(path[i]);
      circular.add(id);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    path.push(id);
    for (const dep of adj.get(id) ?? []) dfs(dep, path);
    path.pop();
    inStack.delete(id);
  }

  for (const id of adj.keys()) {
    if (!visited.has(id)) dfs(id, []);
  }
  return circular;
}

function fileTypeToNodeType(fileType: FileType): NodeType {
  switch (fileType) {
    case 'source': return 'file';
    case 'test':   return 'file';
    default:       return 'file';
  }
}

function folderNodeId(repoId: string, folderPath: string): string {
  return `folder_${repoId}_${folderPath.replace(/\//g, '__')}`;
}

function buildFolderNodes(
  repoId: string,
  files: FileRow2[],
): { folderNodes: GraphNode[]; fileParentIds: Map<string, string | undefined> } {
  const folderPaths = new Set<string>();

  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      folderPaths.add(parts.slice(0, i).join('/'));
    }
  }

  const sortedPaths = [...folderPaths].sort(
    (a, b) => a.split('/').length - b.split('/').length,
  );

  const folderIdByPath = new Map<string, string>();
  const directChildCount = new Map<string, number>();

  const bumpChildCount = (folderPath: string) => {
    directChildCount.set(folderPath, (directChildCount.get(folderPath) ?? 0) + 1);
  };

  for (const folderPath of sortedPaths) {
    const parts = folderPath.split('/');
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
    const nodeId = folderNodeId(repoId, folderPath);
    folderIdByPath.set(folderPath, nodeId);
    if (parentPath) bumpChildCount(parentPath);
  }

  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length <= 1) continue;
    bumpChildCount(parts.slice(0, -1).join('/'));
  }

  const folderNodes: GraphNode[] = sortedPaths.map((folderPath) => {
    const parts = folderPath.split('/');
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;

    return {
      id: folderIdByPath.get(folderPath)!,
      type: 'folder' as const,
      label: parts[parts.length - 1],
      parentId: parentPath ? folderIdByPath.get(parentPath) : undefined,
      data: {
        path: folderPath,
        hasChildren: true,
        childCount: directChildCount.get(folderPath) ?? 0,
        isExpanded: false,
      },
      position: { x: 0, y: 0 },
    };
  });

  const fileParentIds = new Map<string, string | undefined>();
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length <= 1) {
      fileParentIds.set(f.id, undefined);
    } else {
      fileParentIds.set(f.id, folderIdByPath.get(parts.slice(0, -1).join('/')));
    }
  }

  return { folderNodes, fileParentIds };
}

export function buildGraph(
  repoId: string,
  files: FileRow2[],
  deps: DependencyRow[],
  framework: string | null,
  languages: string[],
): GraphData {
  const internalDeps = deps.filter((d) => d.target_file_id != null);

  const adj = new Map<string, string[]>();
  for (const f of files) adj.set(f.id, []);
  for (const d of internalDeps) {
    adj.get(d.source_file_id)?.push(d.target_file_id!);
  }

  const circularNodes = detectCircularNodes(adj);

  const filePathById = new Map<string, string>();
  for (const f of files) filePathById.set(f.id, f.path);

  const importsMap = new Map<string, DependencyRef[]>();
  const importedByMap = new Map<string, DependencyRef[]>();
  for (const f of files) { importsMap.set(f.id, []); importedByMap.set(f.id, []); }

  for (const d of internalDeps) {
    const tgtPath = filePathById.get(d.target_file_id!);
    if (tgtPath) {
      importsMap.get(d.source_file_id)?.push({
        fileId: d.target_file_id!,
        path: tgtPath,
        importType: d.import_type as ImportType,
      });
    }
    const srcPath = filePathById.get(d.source_file_id);
    if (srcPath) {
      importedByMap.get(d.target_file_id!)?.push({
        fileId: d.source_file_id,
        path: srcPath,
        importType: d.import_type as ImportType,
      });
    }
  }

  const importCount = new Map<string, number>();
  const importedByCount = new Map<string, number>();
  for (const f of files) {
    importCount.set(f.id, importsMap.get(f.id)?.length ?? 0);
    importedByCount.set(f.id, importedByMap.get(f.id)?.length ?? 0);
  }

  const { folderNodes, fileParentIds } = buildFolderNodes(repoId, files);
  const nodes: GraphNode[] = [...folderNodes];

  const maxDepth = folderNodes.reduce(
    (max, n) => Math.max(max, (n.data.path?.split('/').length ?? 0)),
    0,
  );

  for (const f of files) {
    const folderId = fileParentIds.get(f.id);
    const imports = importCount.get(f.id) ?? 0;
    const importedBy = importedByCount.get(f.id) ?? 0;
    const isCircular = circularNodes.has(f.id);
    const riskScore = Math.min(100, importedBy * 5 + (isCircular ? 30 : 0));
    const riskLevel =
      riskScore >= 75 ? 'critical' :
      riskScore >= 50 ? 'high' :
      riskScore >= 25 ? 'medium' : 'low';

    let symbols: { functions: FunctionInfo[]; classes: ClassInfo[] } = { functions: [], classes: [] };
    try {
      const parsed = JSON.parse(f.symbols ?? '{}') as typeof symbols;
      if (Array.isArray(parsed.functions)) symbols.functions = parsed.functions;
      if (Array.isArray(parsed.classes)) symbols.classes = parsed.classes;
    } catch { /* leave empty */ }

    nodes.push({
      id: f.id,
      type: fileTypeToNodeType(f.type as FileType),
      label: f.name,
      parentId: folderId,
      data: {
        path: f.path,
        fileType: f.type as FileType,
        language: f.language ?? undefined,
        riskScore,
        riskLevel,
        isDeadCode: importedBy === 0 && imports === 0,
        circularDependencies: isCircular ? [f.id] : [],
        imports: importsMap.get(f.id) ?? [],
        importedBy: importedByMap.get(f.id) ?? [],
        functions: symbols.functions,
        classes: symbols.classes,
        metrics: {
          importCount: imports,
          importedByCount: importedBy,
          functionCount: symbols.functions.length,
          classCount: symbols.classes.length,
          lineCount: f.line_count,
        },
      },
      position: { x: 0, y: 0 },
    });
  }

  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const d of internalDeps) {
    const edgeId = `${d.source_file_id}->${d.target_file_id}`;
    if (edgeSeen.has(edgeId)) continue;
    edgeSeen.add(edgeId);

    const isCircularEdge =
      circularNodes.has(d.source_file_id) && circularNodes.has(d.target_file_id!);

    edges.push({
      id: edgeId,
      source: d.source_file_id,
      target: d.target_file_id!,
      type: isCircularEdge ? 'circular' : 'imports',
      animated: isCircularEdge,
      data: {
        importType: d.import_type as never,
        isCircular: isCircularEdge,
      },
    });
  }

  const circularDepCount = circularNodes.size > 0
    ? Math.floor(circularNodes.size / 2)
    : 0;

  const deadCodeCount = nodes.filter(
    (n) => n.type === 'file' && n.data.isDeadCode,
  ).length;

  const riskSum = nodes
    .filter((n) => n.type === 'file')
    .reduce((s, n) => s + (n.data.riskScore ?? 0), 0);
  const fileNodeCount = nodes.filter((n) => n.type === 'file').length;
  const avgRiskScore = fileNodeCount > 0 ? Math.round(riskSum / fileNodeCount) : 0;

  const metadata: GraphMetadata = {
    repoId,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    maxDepth,
    circularDependencyCount: circularDepCount,
    deadCodeCount,
    avgRiskScore,
    frameworks: framework ? [framework] : [],
    languages,
  };

  return { nodes, edges, metadata };
}
