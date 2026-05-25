import { useState, useEffect } from 'react';
import { X, MousePointer, Search, GitMerge, Skull, BarChart2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'nodemap_onboarding_v1';

const STEPS = [
  {
    icon: <MousePointer className="w-5 h-5 text-primary" />,
    title: 'Click to explore',
    body: 'Use the Tree line view for a clean folder hierarchy — only direct children appear below each expanded folder. Switch to Imports, API, Circular, or All to overlay relationship lines. Click a file to inspect it in the right panel.',
  },
  {
    icon: <Search className="w-5 h-5 text-primary" />,
    title: 'Search anything',
    body: 'Press / to open search. Type a filename, function name, or class — matching nodes highlight instantly. Click a result to jump to it.',
  },
  {
    icon: <GitMerge className="w-5 h-5 text-risk-critical" />,
    title: 'Circular dependencies',
    body: 'Red animated edges show circular imports. Click the Cycles tab in the toolbar to see all cycles grouped, then highlight them on the graph.',
  },
  {
    icon: <Skull className="w-5 h-5 text-muted-foreground" />,
    title: 'Dead code',
    body: 'Faded nodes are files no other file imports. Click the Dead tab to list them all. Click any to jump to it on the graph.',
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-primary" />,
    title: 'Impact analysis',
    body: 'Select any file and scroll the right panel to see "Impact" — how many files would break if this one changed. Click to highlight them.',
  },
];

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in">
      <div className="glass border border-border rounded-lg shadow-2xl w-80 p-5 space-y-4">
        {/* Progress dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  i === step ? 'bg-primary w-4' : 'bg-border hover:bg-muted-foreground',
                )}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            {current.icon}
            <h3 className="text-sm font-mono font-semibold text-foreground">{current.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={dismiss}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            skip tour
          </button>
          <Button
            size="sm"
            variant={isLast ? 'default' : 'outline'}
            className="gap-1 text-xs font-mono h-7"
            onClick={() => isLast ? dismiss() : setStep((s) => s + 1)}
          >
            {isLast ? 'Get started' : 'Next'}
            {!isLast && <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
