import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, Key, Github, Eye, EyeOff } from 'lucide-react';
import { settingsApi } from '@/api/client';
import { TUNNER } from '@/constants/tunner';
import { PageShell, PageError, PageLoading } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { AiProviderId, UpdateSettingsInput } from '@nodemap/types';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data: res, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const update = useMutation({
    mutationFn: (body: UpdateSettingsInput) => settingsApi.update(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    },
  });

  const [provider, setProvider] = useState<AiProviderId>('disabled');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [ignored, setIgnored] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [githubTestStatus, setGithubTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [githubTestError, setGithubTestError] = useState<string | null>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);

  useEffect(() => {
    if (!res?.data) return;
    setProvider(res.data.ai.provider);
    setModel(res.data.ai.model ?? '');
    setIgnored(res.data.ignoredPaths.join('\n'));
  }, [res?.data]);

  if (isLoading) return <PageLoading />;
  if (error) return <PageShell title="Settings"><PageError error={error} /></PageShell>;
  if (!res?.data) return null;

  function saveAi() {
    const body: UpdateSettingsInput = {
      ai: { provider, model: model || undefined, ...(apiKey ? { apiKey } : {}) },
    };
    update.mutate(body);
    setApiKey('');
  }

  function saveIgnored() {
    const paths = ignored.split('\n').map((s) => s.trim()).filter(Boolean);
    update.mutate({ ignoredPaths: paths });
  }

  async function testConnection() {
    setTestStatus('testing'); setTestError(null);
    try {
      if (provider !== 'disabled') {
        await settingsApi.update({
          ai: {
            provider,
            model: model.trim() || undefined,
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          },
        });
        if (apiKey.trim()) setApiKey('');
        await qc.invalidateQueries({ queryKey: ['settings'] });
      }
      const r = await settingsApi.testAi();
      if (r.data?.ok) setTestStatus('ok');
      else { setTestStatus('fail'); setTestError(r.data?.error ?? 'Connection failed'); }
    } catch (e) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : String(e));
    }
  }

  async function testGithubConnection() {
    setGithubTestStatus('testing'); setGithubTestError(null); setGithubLogin(null);
    try {
      if (githubToken.trim()) {
        await settingsApi.update({ github: { token: githubToken.trim() } });
        setGithubToken('');
        await qc.invalidateQueries({ queryKey: ['settings'] });
      }
      const r = await settingsApi.testGithub();
      if (r.data?.ok) {
        setGithubTestStatus('ok');
        setGithubLogin(r.data.login ?? null);
      } else {
        setGithubTestStatus('fail');
        setGithubTestError(r.data?.error ?? 'Connection failed');
      }
    } catch (e) {
      setGithubTestStatus('fail');
      setGithubTestError(e instanceof Error ? e.message : String(e));
    }
  }

  function removeAiKey() {
    update.mutate(
      { ai: { provider, apiKey: '' } },
      {
        onSuccess: () => {
          setApiKey('');
          setTestStatus('idle');
          setTestError(null);
        },
      },
    );
  }

  function removeGithubToken() {
    update.mutate(
      { github: { token: '' } },
      {
        onSuccess: () => {
          setGithubToken('');
          setGithubTestStatus('idle');
          setGithubTestError(null);
          setGithubLogin(null);
        },
      },
    );
  }

  return (
    <PageShell title="Settings" subtitle="Configure AI, ignored paths and integrations">
      {/* AI Provider */}
      <section className="border border-border rounded-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-mono text-foreground flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-primary" />
            AI Provider
          </h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {TUNNER.settingsNote}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Provider</label>
          <div className="flex gap-2">
            {(['disabled', 'openai', 'gemini'] as AiProviderId[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={cn(
                  'text-xs font-mono px-3 py-1.5 rounded-sm border',
                  provider === p ? 'border-primary text-primary bg-primary/8' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {provider !== 'disabled' && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
                className="w-full md:w-80 bg-background border border-border rounded-sm px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">API Key</label>
              <div className="flex items-center gap-2 max-w-md">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={res.data.ai.apiKeySet ? '••• already set (paste to replace)' : 'paste API key'}
                    className="w-full bg-background border border-border rounded-sm px-3 py-1.5 text-xs font-mono pr-8 focus:outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/60">
                Stored locally in the API database. Get one at{' '}
                {provider === 'openai'
                  ? <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">platform.openai.com/api-keys</a>
                  : <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com</a>}.
              </p>
              {provider === 'openai' && (
                <p className="text-[10px] font-mono text-muted-foreground/60">
                  Key must start with <code className="text-foreground/80">sk-</code>. Leave model empty for{' '}
                  <code className="text-foreground/80">gpt-4o-mini</code>. Avoid <code className="text-foreground/80">o1</code> /{' '}
                  <code className="text-foreground/80">o3</code> unless you know they work on your account.
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={saveAi}
            disabled={update.isPending}
            className="text-xs font-mono px-3 py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            {update.isPending ? 'saving…' : 'Save'}
          </button>
          {provider !== 'disabled' && res.data.ai.apiKeySet && (
            <button
              type="button"
              onClick={removeAiKey}
              disabled={update.isPending}
              className="text-xs font-mono px-3 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-40"
            >
              Remove key
            </button>
          )}
          <button
            onClick={testConnection}
            disabled={
              testStatus === 'testing'
              || provider === 'disabled'
              || (!res.data.ai.apiKeySet && !apiKey.trim())
            }
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-sm border border-border text-foreground hover:bg-secondary/40 disabled:opacity-40"
          >
            {testStatus === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
            {testStatus === 'ok' && <CheckCircle2 className="w-3 h-3 text-primary" />}
            {testStatus === 'fail' && <XCircle className="w-3 h-3 text-destructive" />}
            Test connection
          </button>
          {testStatus === 'fail' && testError && (
            <span className="text-[10px] font-mono text-destructive max-w-xl break-words">{testError}</span>
          )}
          {testStatus === 'ok' && (
            <span className="text-[10px] font-mono text-primary">connection successful</span>
          )}
        </div>
      </section>

      {/* Ignored paths */}
      <section className="border border-border rounded-sm p-5 space-y-3">
        <h2 className="text-sm font-mono text-foreground">Ignored paths</h2>
        <p className="text-xs font-mono text-muted-foreground">
          Future scans will skip files matching these globs. (One per line.)
        </p>
        <textarea
          value={ignored}
          onChange={(e) => setIgnored(e.target.value)}
          rows={5}
          placeholder={'docs/**\n*.generated.ts'}
          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/40"
        />
        <button
          onClick={saveIgnored}
          disabled={update.isPending}
          className="text-xs font-mono px-3 py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          {update.isPending ? 'saving…' : 'Save'}
        </button>
      </section>

      {/* GitHub */}
      <section className="border border-border rounded-sm p-5 space-y-3">
        <h2 className="text-sm font-mono text-foreground flex items-center gap-2">
          <Github className="w-3.5 h-3.5" /> GitHub integration
        </h2>
        <p className="text-xs font-mono text-muted-foreground">
          Used by <strong className="font-normal text-foreground/80">PR Impact</strong> to fetch changed files from a pull request.
          Public repos work without a token; private repos need a classic PAT with <code className="text-foreground/80">repo</code> scope.
        </p>

        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Personal access token</label>
          <div className="flex items-center gap-2 max-w-md">
            <div className="flex-1 relative">
              <input
                type={showGithubToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={res.data.github.connected ? '••• already set (paste to replace)' : 'ghp_…'}
                className="w-full bg-background border border-border rounded-sm px-3 py-1.5 text-xs font-mono pr-8 focus:outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowGithubToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showGithubToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/60">
            Create at{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-primary underline">
              github.com/settings/tokens
            </a>
            . Stored locally in the API database.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={async () => {
              if (githubToken.trim()) {
                await update.mutateAsync({ github: { token: githubToken.trim() } });
                setGithubToken('');
              }
            }}
            disabled={update.isPending || !githubToken.trim()}
            className="text-xs font-mono px-3 py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            {update.isPending ? 'saving…' : 'Save token'}
          </button>
          {res.data.github.connected && (
            <button
              type="button"
              onClick={removeGithubToken}
              disabled={update.isPending}
              className="text-xs font-mono px-3 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-40"
            >
              Remove token
            </button>
          )}
          <button
            type="button"
            onClick={testGithubConnection}
            disabled={
              githubTestStatus === 'testing'
              || (!res.data.github.connected && !githubToken.trim())
            }
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-sm border border-border text-foreground hover:bg-secondary/40 disabled:opacity-40"
          >
            {githubTestStatus === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
            {githubTestStatus === 'ok' && <CheckCircle2 className="w-3 h-3 text-primary" />}
            {githubTestStatus === 'fail' && <XCircle className="w-3 h-3 text-destructive" />}
            Test connection
          </button>
          {githubTestStatus === 'ok' && (
            <span className="text-[10px] font-mono text-primary">
              connected{githubLogin ? ` as @${githubLogin}` : ''}
            </span>
          )}
          {githubTestStatus === 'fail' && githubTestError && (
            <span className="text-[10px] font-mono text-destructive max-w-xl break-words">{githubTestError}</span>
          )}
        </div>
      </section>
    </PageShell>
  );
}
