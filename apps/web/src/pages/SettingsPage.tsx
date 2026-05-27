import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  IconKey, IconBrandGithub, IconSettings, IconCode,
  IconCheck, IconX,
} from '@tabler/icons-react';
import { settingsApi } from '@/api/client';
import { TUNNER } from '@/constants/tunner';
import { PageShell, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { AiProviderId, UpdateSettingsInput } from '@nodemap/types';

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <StudioCard>
      <div className="flex items-start gap-3 px-5 py-4 border-b border-[#E4E7EC]">
        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <Icon size={15} className="text-[#2563EB]" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[#111827]">{title}</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </StudioCard>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
      {children}
    </label>
  );
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

function TestStatusIcon({ status }: { status: TestState }) {
  if (status === 'testing') return <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />;
  if (status === 'ok')      return <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />;
  if (status === 'fail')    return <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />;
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  const [provider,           setProvider]           = useState<AiProviderId>('disabled');
  const [model,              setModel]              = useState('');
  const [apiKey,             setApiKey]             = useState('');
  const [showKey,            setShowKey]            = useState(false);
  const [showGithubToken,    setShowGithubToken]    = useState(false);
  const [githubToken,        setGithubToken]        = useState('');
  const [ignored,            setIgnored]            = useState('');
  const [testStatus,         setTestStatus]         = useState<TestState>('idle');
  const [testError,          setTestError]          = useState<string | null>(null);
  const [githubTestStatus,   setGithubTestStatus]   = useState<TestState>('idle');
  const [githubTestError,    setGithubTestError]    = useState<string | null>(null);
  const [githubLogin,        setGithubLogin]        = useState<string | null>(null);

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
    update.mutate({
      ai: { provider, model: model || undefined, ...(apiKey ? { apiKey } : {}) },
    });
    setApiKey('');
  }

  function saveIgnored() {
    const paths = ignored.split('\n').map((s) => s.trim()).filter(Boolean);
    update.mutate({ ignoredPaths: paths });
  }

  async function testAiConnection() {
    setTestStatus('testing'); setTestError(null);
    try {
      if (provider !== 'disabled') {
        await settingsApi.update({
          ai: { provider, model: model.trim() || undefined, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) },
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
    update.mutate({ ai: { provider, apiKey: '' } }, {
      onSuccess: () => { setApiKey(''); setTestStatus('idle'); setTestError(null); },
    });
  }

  function removeGithubToken() {
    update.mutate({ github: { token: '' } }, {
      onSuccess: () => {
        setGithubToken(''); setGithubTestStatus('idle');
        setGithubTestError(null); setGithubLogin(null);
      },
    });
  }

  const PROVIDERS: { id: AiProviderId; label: string }[] = [
    { id: 'disabled', label: 'Disabled' },
    { id: 'openai',   label: 'OpenAI' },
    { id: 'gemini',   label: 'Gemini' },
  ];

  return (
    <PageShell title="Settings" subtitle="Configure AI provider, ignored paths, and integrations">
      <div className="space-y-5 max-w-2xl">
        {/* ── AI Provider ─────────────────────────────────── */}
        <SettingsSection
          icon={IconKey}
          title="AI Provider"
          description={TUNNER.settingsNote}
        >
          {/* Provider selector */}
          <div>
            <FieldLabel>Provider</FieldLabel>
            <div className="flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors',
                    provider === p.id
                      ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                      : 'bg-white border-[#E4E7EC] text-[#6B7280] hover:text-[#111827]',
                  )}
                >
                  {provider === p.id && <IconCheck size={12} />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {provider !== 'disabled' && (
            <>
              {/* Model */}
              <div>
                <FieldLabel>Model (optional)</FieldLabel>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
                  className="studio-input max-w-sm"
                />
              </div>

              {/* API Key */}
              <div>
                <FieldLabel>API Key</FieldLabel>
                <div className="relative max-w-sm">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={res.data.ai.apiKeySet ? '••• already set (paste to replace)' : 'Paste API key'}
                    className="studio-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                  Stored locally. Get one at{' '}
                  {provider === 'openai'
                    ? <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">platform.openai.com/api-keys</a>
                    : <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">aistudio.google.com</a>
                  }.
                </p>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={saveAi}
              disabled={update.isPending}
              className="h-8 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors"
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </button>

            {provider !== 'disabled' && res.data.ai.apiKeySet && (
              <button
                onClick={removeAiKey}
                disabled={update.isPending}
                className="h-8 px-4 rounded-lg text-[12px] font-medium text-[#6B7280] bg-white border border-[#E4E7EC] hover:text-[#DC2626] hover:border-[#FECACA] disabled:opacity-40 transition-colors"
              >
                Remove key
              </button>
            )}

            <button
              onClick={testAiConnection}
              disabled={testStatus === 'testing' || provider === 'disabled' || (!res.data.ai.apiKeySet && !apiKey.trim())}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium text-[#374151] bg-white border border-[#E4E7EC] hover:bg-[#F8F9FB] disabled:opacity-40 transition-colors"
            >
              <TestStatusIcon status={testStatus} />
              Test connection
            </button>

            {testStatus === 'ok' && (
              <span className="text-[11px] font-medium text-[#059669]">✓ Connected successfully</span>
            )}
            {testStatus === 'fail' && testError && (
              <span className="text-[11px] text-[#DC2626] max-w-sm break-words">{testError}</span>
            )}
          </div>
        </SettingsSection>

        {/* ── Ignored Paths ────────────────────────────────── */}
        <SettingsSection
          icon={IconCode}
          title="Ignored Paths"
          description="Future scans skip files matching these glob patterns (one per line)."
        >
          <textarea
            value={ignored}
            onChange={(e) => setIgnored(e.target.value)}
            rows={5}
            placeholder={'docs/**\n*.generated.ts\ndist/**'}
            className="studio-input font-mono resize-none"
          />
          <button
            onClick={saveIgnored}
            disabled={update.isPending}
            className="h-8 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </SettingsSection>

        {/* ── GitHub ──────────────────────────────────────── */}
        <SettingsSection
          icon={IconBrandGithub}
          title="GitHub Integration"
          description="Used by PR Impact to fetch changed files from a pull request. Public repos work without a token; private repos need a classic PAT with repo scope."
        >
          {/* Token status */}
          {res.data.github.connected && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
              <span className="text-[12px] text-[#065F46]">
                GitHub token configured
                {githubLogin ? ` — connected as @${githubLogin}` : ''}
              </span>
            </div>
          )}

          <div>
            <FieldLabel>Personal access token</FieldLabel>
            <div className="relative max-w-sm">
              <input
                type={showGithubToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={res.data.github.connected ? '••• already set (paste to replace)' : 'ghp_…'}
                className="studio-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGithubToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-1.5">
              Create at{' '}
              <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">
                github.com/settings/tokens
              </a>
              . Stored locally in the API database.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={update.isPending || !githubToken.trim()}
              onClick={async () => {
                if (githubToken.trim()) {
                  await update.mutateAsync({ github: { token: githubToken.trim() } });
                  setGithubToken('');
                }
              }}
              className="h-8 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors"
            >
              {update.isPending ? 'Saving…' : 'Save token'}
            </button>

            {res.data.github.connected && (
              <button
                type="button"
                onClick={removeGithubToken}
                disabled={update.isPending}
                className="h-8 px-4 rounded-lg text-[12px] font-medium text-[#6B7280] bg-white border border-[#E4E7EC] hover:text-[#DC2626] hover:border-[#FECACA] disabled:opacity-40 transition-colors"
              >
                Remove token
              </button>
            )}

            <button
              type="button"
              onClick={testGithubConnection}
              disabled={githubTestStatus === 'testing' || (!res.data.github.connected && !githubToken.trim())}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium text-[#374151] bg-white border border-[#E4E7EC] hover:bg-[#F8F9FB] disabled:opacity-40 transition-colors"
            >
              <TestStatusIcon status={githubTestStatus} />
              Test connection
            </button>

            {githubTestStatus === 'ok' && (
              <span className="text-[11px] font-medium text-[#059669]">
                ✓ Connected{githubLogin ? ` as @${githubLogin}` : ''}
              </span>
            )}
            {githubTestStatus === 'fail' && githubTestError && (
              <span className="text-[11px] text-[#DC2626] max-w-sm break-words">{githubTestError}</span>
            )}
          </div>
        </SettingsSection>
      </div>
    </PageShell>
  );
}
