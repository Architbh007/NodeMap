import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, FolderArchive, CheckCircle, AlertCircle, ArrowRight,
  Info, FileCode, Layers, TestTube, Settings, Palette, Clock,
  Link, Github, Lock, ChevronDown, ChevronUp, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCreateRepository } from '@/hooks/useRepository';
import { repoApi, fromUrlApi, type FromUrlInput } from '@/api/client';
import { formatBytes } from '@nodemap/shared';
import { useActiveRepo } from '@/store/activeRepoStore';
import type { IngestionResult } from '@nodemap/types';

const MAX_FILE_SIZE = 100 * 1024 * 1024;
type Mode = 'url' | 'zip';
type Phase = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

// ─── Shared results view ──────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border', color)}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function AnalysisResults({
  result,
  repoId,
  onReset,
}: {
  result: IngestionResult;
  repoId: string;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const { setRepoId } = useActiveRepo();
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-risk-low/10 border border-risk-low/30">
        <CheckCircle className="w-5 h-5 text-risk-low shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Analysis complete!</p>
          <p className="text-xs text-muted-foreground">
            Scanned in {result.processingTimeMs < 1000
              ? `${result.processingTimeMs}ms`
              : `${(result.processingTimeMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<FileCode className="w-4 h-4 text-node-file" />}   label="Total files"   value={result.fileCount.toLocaleString()} color="border-border bg-card" />
        <StatCard icon={<Layers    className="w-4 h-4 text-indigo-400" />}  label="Source files"  value={result.sourceFiles.toLocaleString()} color="border-border bg-card" />
        <StatCard icon={<TestTube  className="w-4 h-4 text-emerald-400" />} label="Test files"    value={result.testFiles.toLocaleString()} color="border-border bg-card" />
        <StatCard icon={<Settings  className="w-4 h-4 text-amber-400" />}   label="Config files"  value={result.configFiles.toLocaleString()} color="border-border bg-card" />
        <StatCard icon={<Palette   className="w-4 h-4 text-pink-400" />}    label="Style files"   value={result.styleFiles.toLocaleString()} color="border-border bg-card" />
        <StatCard icon={<Clock     className="w-4 h-4 text-muted-foreground" />} label="Total size" value={formatBytes(result.totalSize)} color="border-border bg-card" />
      </div>

      {result.languages.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Languages detected</p>
          <div className="space-y-2">
            {result.languages.slice(0, 6).map((lang) => (
              <div key={lang.language} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">{lang.language}</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${lang.percentage}%` }} />
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0 w-8 text-right">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {result.framework && <Badge variant="default" className="text-xs">{result.framework}</Badge>}
        {result.topLevelDirs.slice(0, 8).map((dir) => (
          <Badge key={dir} variant="secondary" className="text-xs font-mono">{dir}/</Badge>
        ))}
      </div>

      <Button size="lg" variant="glow" className="w-full gap-2" onClick={() => { setRepoId(repoId); navigate(`/dashboard`); }}>
        Open Dashboard <ArrowRight className="w-4 h-4" />
      </Button>
      <button onClick={onReset} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
        Analyze another repository
      </button>
    </div>
  );
}

// ─── URL mode ─────────────────────────────────────────────

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'github') return <Github className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

function UrlForm({
  onDone,
}: {
  onDone: (result: IngestionResult, repoId: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branch, setBranch] = useState('');
  const [token, setToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ provider: string; owner: string; repo: string } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();

  // Live URL preview (debounced)
  useEffect(() => {
    clearTimeout(previewTimer.current);
    if (!url.trim()) { setPreview(null); return; }
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fromUrlApi.preview(url.trim());
        if (res.success && res.data) {
          setPreview(res.data);
          if (!name) setName(res.data.suggestedName);
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      }
    }, 400);
    return () => clearTimeout(previewTimer.current);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) { setError('Paste a repository URL first.'); return; }

    setPhase('analyzing');
    setError('');

    const input: FromUrlInput = {
      url: url.trim(),
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      branch: branch.trim() || undefined,
      token: token.trim() || undefined,
    };

    try {
      const res = await fromUrlApi.analyze(input);
      if (!res.success || !res.data) throw new Error(res.error ?? 'Analysis failed');

      // Server now returns repoId directly in the response
      const repoId = res.data.repoId ?? '';
      onDone(res.data, repoId);
    } catch (err) {
      setPhase('error');
      setError((err as Error).message);
    }
  };

  const isActive = phase === 'analyzing';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Repository URL *</label>
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="pl-8 font-mono text-sm"
            disabled={isActive}
          />
        </div>

        {/* Live preview chip */}
        {preview && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
            <ProviderIcon provider={preview.provider} />
            <span className="text-foreground font-medium">{preview.owner}/{preview.repo}</span>
            <Badge variant="secondary" className="text-[10px] capitalize">{preview.provider}</Badge>
          </div>
        )}
      </div>

      {/* Repo metadata */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Display Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-detected from URL"
            disabled={isActive}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional" rows={2} disabled={isActive} />
        </div>
      </div>

      {/* Advanced options */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced options
      </button>

      {showAdvanced && (
        <div className="glass rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Branch</label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)}
              placeholder="main (auto-detected)" disabled={isActive} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Personal Access Token (private repos)
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              disabled={isActive}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Token is used only for this request and never stored.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {isActive && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Downloading & analyzing…</p>
            <p className="text-xs text-muted-foreground">Fetching archive, scanning files, detecting dependencies</p>
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full gap-2" disabled={isActive || !url.trim()}>
        {isActive
          ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
          : <><Globe className="w-4 h-4" /> Analyze from URL</>
        }
      </Button>
    </form>
  );
}

// ─── ZIP mode ─────────────────────────────────────────────

function ZipForm({
  onDone,
}: {
  onDone: (result: IngestionResult, repoId: string) => void;
}) {
  const { mutateAsync: createRepo, isPending: isCreating } = useCreateRepository();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState('');

  const onFileSelected = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.zip')) { setError('Only .zip files are supported.'); return; }
    if (f.size > MAX_FILE_SIZE) { setError(`File too large (${formatBytes(f.size)}). Max 100 MB.`); return; }
    setError('');
    setFile(f);
    if (!name) setName(f.name.replace(/\.zip$/i, ''));
  }, [name]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileSelected(dropped);
  }, [onFileSelected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Repository name is required.'); return; }
    if (!file)        { setError('Please select a ZIP file.'); return; }

    try {
      setPhase('uploading'); setUploadPct(0); setError('');
      const repo = await createRepo({ name: name.trim(), description: description.trim() || undefined });
      setPhase('analyzing');
      const res = await repoApi.upload(repo.id, file, setUploadPct);
      if (!res.success || !res.data) throw new Error(res.error ?? 'Analysis failed');
      onDone(res.data, repo.id);
    } catch (err) {
      setPhase('error');
      setError((err as Error).message);
    }
  };

  const isActive = phase === 'uploading' || phase === 'analyzing';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        onClick={() => !isActive && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-200',
          isActive ? 'pointer-events-none opacity-60' : 'cursor-pointer',
          isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-secondary/30',
          file && !isActive && 'border-primary/50 bg-primary/5',
        )}
      >
        <input ref={fileInputRef} type="file" accept=".zip" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])} />

        {file ? (
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><FolderArchive className="w-6 h-6" /></div>
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setName(''); }}
              className="ml-4 p-1 rounded hover:bg-secondary text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-xl bg-secondary/60 mb-4"><Upload className="w-7 h-7 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground mb-1">Drop your repository ZIP here</p>
            <p className="text-xs text-muted-foreground">or click to browse · Max 100 MB</p>
            <Badge variant="secondary" className="mt-3 text-[10px]">.zip</Badge>
          </>
        )}
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Repository Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="my-awesome-project" disabled={isActive} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional" rows={2} disabled={isActive} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {phase === 'uploading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Uploading…</span>
            <span className="text-primary font-mono">{uploadPct}%</span>
          </div>
          <Progress value={uploadPct} className="h-1.5" />
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm font-medium text-foreground">Analyzing repository…</p>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full gap-2"
        disabled={isActive || isCreating || !name.trim() || !file}>
        {isActive
          ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
          : <><Upload className="w-4 h-4" /> Analyze Repository</>}
      </Button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────

export function UploadPage() {
  const [mode, setMode] = useState<Mode>('url');
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [repoId, setRepoId] = useState('');

  const handleDone = useCallback((r: IngestionResult, id: string) => {
    setResult(r);
    setRepoId(id);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setRepoId('');
  }, []);

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6 animate-fade-in">

        <div className="space-y-0.5">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <span className="text-primary">$</span> nodemap analyze
          </p>
          <h1 className="text-xl font-bold font-mono text-foreground">Analyze a Repository</h1>
          <p className="text-sm text-muted-foreground pt-0.5">
            Paste a URL or upload a ZIP — NodeMap builds the full architecture map
          </p>
        </div>

        {result ? (
          <AnalysisResults result={result} repoId={repoId} onReset={handleReset} />
        ) : (
          <>
            {/* Mode toggle — underline tabs */}
            <div className="flex items-center gap-6 border-b border-border">
              {([
                { id: 'url' as Mode, label: 'from url', icon: <Link className="w-3.5 h-3.5" /> },
                { id: 'zip' as Mode, label: 'upload zip', icon: <FolderArchive className="w-3.5 h-3.5" /> },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 pb-2.5 text-sm font-mono transition-colors border-b-2 -mb-px',
                    mode === tab.id
                      ? 'text-primary border-primary/60'
                      : 'text-muted-foreground border-transparent hover:text-foreground',
                  )}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border text-xs text-muted-foreground font-mono">
              <Info className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
              <span>
                <span className="text-foreground">static analysis only</span> — code is never executed.
                node_modules, binaries and lock files are ignored.
              </span>
            </div>

            {mode === 'url'
              ? <UrlForm onDone={handleDone} />
              : <ZipForm onDone={handleDone} />
            }
          </>
        )}
      </div>
    </div>
  );
}
