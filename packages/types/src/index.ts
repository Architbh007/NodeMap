// ============================================================
// Repository
// ============================================================

export interface Repository {
  id: string;
  name: string;
  description?: string;
  status: RepositoryStatus;
  uploadPath?: string;
  fileCount: number;
  totalSize: number;
  languages: string[];
  framework?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type RepositoryStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface CreateRepositoryInput {
  name: string;
  description?: string;
}

// ============================================================
// Source Files
// ============================================================

export interface SourceFile {
  id: string;
  repoId: string;
  path: string;
  name: string;
  extension?: string;
  size: number;
  type: FileType;
  language?: string;
  lineCount: number;
  createdAt: string;
}

export type FileType = 'source' | 'test' | 'config' | 'style' | 'asset' | 'other';

// ============================================================
// Dependencies
// ============================================================

export interface Dependency {
  id: string;
  repoId: string;
  sourceFileId: string;
  targetFileId?: string;
  targetModule?: string;
  importType: ImportType;
  createdAt: string;
}

export type ImportType = 'default' | 'named' | 'namespace' | 'side-effect' | 'dynamic';

// ============================================================
// Graph
// ============================================================

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: NodeData;
  position: { x: number; y: number };
  parentId?: string;
}

export type NodeType = 'folder' | 'file' | 'service' | 'route' | 'module' | 'group';

export interface NodeData {
  path?: string;
  fileType?: FileType;
  language?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  isExpanded?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  imports?: DependencyRef[];
  importedBy?: DependencyRef[];
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  routes?: RouteInfo[];
  circularDependencies?: string[];
  isDeadCode?: boolean;
  metrics?: NodeMetrics;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DependencyRef {
  fileId: string;
  path: string;
  importType: ImportType;
}

export interface FunctionInfo {
  name: string;
  isExported: boolean;
  isAsync: boolean;
  params: string[];
  returnType?: string;
  lineStart: number;
  lineEnd: number;
}

export interface ClassInfo {
  name: string;
  isExported: boolean;
  methods: string[];
  properties: string[];
  lineStart: number;
  lineEnd: number;
}

export interface RouteInfo {
  method: HttpMethod;
  path: string;
  controller?: string;
  service?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface NodeMetrics {
  importCount: number;
  importedByCount: number;
  functionCount: number;
  classCount: number;
  lineCount: number;
  complexity?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  animated?: boolean;
  data?: EdgeData;
}

export type EdgeType = 'imports' | 'contains' | 'api-flow' | 'service-usage' | 'circular';

export interface EdgeData {
  importType?: ImportType;
  isCircular?: boolean;
  weight?: number;
}

export interface GraphMetadata {
  repoId: string;
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  circularDependencyCount: number;
  deadCodeCount: number;
  avgRiskScore: number;
  frameworks: string[];
  languages: string[];
}

// ============================================================
// Graph UI State
// ============================================================

/** Overlay analysis modes (risk / impact opacity). Layout always uses folder tree. */
export type GraphMode = 'folder' | 'risk' | 'impact';

/** What relationship lines to draw on the repo graph. */
export type GraphEdgeView = 'structure' | 'imports' | 'api' | 'circular' | 'combined';

// ============================================================
// Analysis
// ============================================================

export interface AnalysisResult {
  id: string;
  repoId: string;
  type: AnalysisType;
  data: unknown;
  createdAt: string;
}

export type AnalysisType =
  | 'circular_deps'
  | 'dead_code'
  | 'risk_scores'
  | 'api_flows'
  | 'complexity'
  | 'coupling'
  | 'overview';

export interface RepositoryOverview {
  fileCount: number;
  sourceFiles: number;
  testFiles: number;
  configFiles: number;
  totalDependencies: number;
  internalDependencies: number;
  externalDependencies: number;
  circularDependencyCount: number;
  deadCodeCount: number;
  avgRiskScore: number;
  highRiskFiles: number;
  frameworks: string[];
  languages: LanguageStat[];
  topDependencies: DependencyStat[];
  mostConnectedFiles: ConnectionStat[];
}

export interface LanguageStat {
  language: string;
  fileCount: number;
  percentage: number;
}

export interface DependencyStat {
  module: string;
  importCount: number;
}

export interface ConnectionStat {
  fileId: string;
  path: string;
  connectionCount: number;
  riskScore: number;
}

// ============================================================
// Ingestion (Phase 2)
// ============================================================

export interface IngestionResult {
  repoId?: string;
  fileCount: number;
  sourceFiles: number;
  testFiles: number;
  configFiles: number;
  styleFiles: number;
  assetFiles: number;
  otherFiles: number;
  totalSize: number;
  languages: LanguageStat[];
  framework?: string;
  topLevelDirs: string[];
  processingTimeMs: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  fileType?: FileType;
  children?: FileTreeNode[];
}

// ============================================================
// Upload
// ============================================================

export interface UploadProgress {
  stage: UploadStage;
  progress: number;
  message: string;
  error?: string;
}

export type UploadStage =
  | 'uploading'
  | 'extracting'
  | 'scanning'
  | 'parsing'
  | 'building'
  | 'analyzing'
  | 'complete'
  | 'error';

// ============================================================
// API
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
  uptime: number;
}

// ============================================================
// AI
// ============================================================

export type AiProviderId = 'openai' | 'gemini' | 'disabled';

export interface AiStatus {
  configured: boolean;
  provider: AiProviderId;
  model: string;
}

export interface AiRepoBrief {
  summary: string;
  entryPoints: string[];
  risks: string[];
  generatedAt: string;
}

export interface AiNodeExplain {
  nodeId: string;
  path: string;
  summary: string;
  role: string;
  impact: string;
  safeToChange: string;
  generatedAt: string;
}

// ============================================================
// Endpoint detection
// ============================================================

export interface DetectedEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  routeFile: string;
  routeFileId?: string;
  handler?: string;
  handlerLine?: number;
  controllerFile?: string;
  controllerFileId?: string;
  serviceChain: string[];
  serviceChainIds: string[];
  repositoryChain: string[];
  repositoryChainIds: string[];
  middleware: string[];
  externalServices: string[];
  database?: string;
  framework: 'express' | 'fastify' | 'koa' | 'router' | 'nest' | 'unknown';
}

export interface EndpointFlowStep {
  layer: ArchitectureLayer;
  fileId?: string;
  path: string;
  label: string;
  detail?: string;
}

export interface EndpointFlow {
  endpoint: DetectedEndpoint;
  steps: EndpointFlowStep[];
}

// ============================================================
// Architecture layers
// ============================================================

export type ArchitectureLayer =
  | 'route'
  | 'controller'
  | 'service'
  | 'repository'
  | 'middleware'
  | 'util'
  | 'config'
  | 'model'
  | 'view'
  | 'test'
  | 'entry'
  | 'unknown';

export interface FileLayerInfo {
  fileId: string;
  path: string;
  layer: ArchitectureLayer;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================
// Risk scoring
// ============================================================

export interface RiskInputs {
  incomingDeps: number;
  outgoingDeps: number;
  affectedEndpoints: number;
  inCircularDep: boolean;
  fileSize: number;
  lineCount: number;
  functionCount: number;
  classCount: number;
  centrality: number;
}

export interface RiskScore {
  fileId: string;
  path: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  inputs: RiskInputs;
}

// ============================================================
// Impact analysis
// ============================================================

export interface ImpactResult {
  fileId: string;
  path: string;
  directDependents: ImpactRef[];
  indirectDependents: ImpactRef[];
  affectedEndpoints: DetectedEndpoint[];
  affectedModules: string[];
  riskLevel: RiskLevel;
}

export interface ImpactRef {
  fileId: string;
  path: string;
  layer: ArchitectureLayer;
}

// ============================================================
// Dead code
// ============================================================

export interface DeadCodeCandidate {
  fileId: string;
  path: string;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  falsePositiveReasons: string[];
}

// ============================================================
// Unified analysis envelope
// ============================================================

export interface RepoAnalysis {
  repoId: string;
  repoName: string;
  framework?: string;
  languages: string[];
  fileCount: number;
  folderCount: number;
  totalSize: number;

  dependencies: {
    total: number;
    internal: number;
    external: number;
    circular: string[][];
  };

  endpoints: DetectedEndpoint[];

  riskScores: RiskScore[];

  deadCodeCandidates: DeadCodeCandidate[];

  layers: FileLayerInfo[];

  topConnected: ConnectionStat[];

  endpointsByMethod: Record<HttpMethod, number>;

  healthScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  generatedAt: string;
}

// ============================================================
// PR Impact
// ============================================================

export interface PrImpactRequest {
  changedFiles: string[];
}

export interface PrImpactResult {
  changedFiles: string[];
  directDependents: ImpactRef[];
  indirectDependents: ImpactRef[];
  affectedEndpoints: DetectedEndpoint[];
  affectedModules: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
}

// ============================================================
// Settings
// ============================================================

export interface AppSettings {
  ai: {
    provider: AiProviderId;
    apiKeySet: boolean;
    model?: string;
  };
  ignoredPaths: string[];
  graph: {
    showExternalModules: boolean;
    edgeAnimations: boolean;
  };
  github: {
    connected: boolean;
    token?: string;
  };
}

export interface UpdateSettingsInput {
  ai?: Partial<AppSettings['ai']> & { apiKey?: string };
  ignoredPaths?: string[];
  graph?: Partial<AppSettings['graph']>;
  github?: Partial<AppSettings['github']> & { token?: string };
}

// ============================================================
// Reports
// ============================================================

export type ReportFormat = 'markdown' | 'json';

export interface ReportRequest {
  sections: ReportSection[];
  format: ReportFormat;
}

export type ReportSection =
  | 'overview'
  | 'architecture'
  | 'endpoints'
  | 'dependencies'
  | 'risk'
  | 'circular'
  | 'deadcode'
  | 'recommendations';
