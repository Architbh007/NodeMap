import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, GitBranch } from 'lucide-react';
import { IconPlus } from '@tabler/icons-react';

interface PageShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Full-bleed: don't wrap in padding container (for graph pages). */
  fullBleed?: boolean;
  /** Remove max-width cap (for wide layouts). */
  wide?: boolean;
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  fullBleed = false,
  wide = false,
}: PageShellProps) {
  if (fullBleed) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div className={`px-6 py-5 space-y-4 ${wide ? '' : 'max-w-7xl mx-auto'}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 min-h-[36px]">
          <div>
            {title && (
              <h1 className="text-[18px] font-medium text-[#111827] leading-tight">{title}</h1>
            )}
            {subtitle && (
              <p className="text-[13px] text-[#6B7280] mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function NoRepoState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
        <GitBranch className="w-5 h-5 text-[#2563EB]" />
      </div>
      <div>
        <h2 className="text-[15px] font-medium text-[#111827]">{title}</h2>
        {subtitle && (
          <p className="text-[13px] text-[#6B7280] mt-1 max-w-sm">{subtitle}</p>
        )}
      </div>
      <Link
        to="/upload"
        className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
      >
        <IconPlus size={14} />
        Analyze a repository
      </Link>
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex items-start gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
      <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-medium text-[#991B1B]">Something went wrong</p>
        <p className="text-[12px] text-[#DC2626]/80 mt-0.5 font-mono">{message}</p>
      </div>
    </div>
  );
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-[13px] text-[#6B7280]">
      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
      <span>{label}</span>
    </div>
  );
}

/** Generic Studio card wrapper */
export function StudioCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-[#E4E7EC] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

/** Section heading inside cards */
export function CardSection({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E7EC]">
        <p className="text-[12px] font-medium text-[#111827]">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
