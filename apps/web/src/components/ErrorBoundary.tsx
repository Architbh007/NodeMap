import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-mono font-medium text-foreground">Something crashed</p>
          <p className="text-xs font-mono text-muted-foreground max-w-sm">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-mono text-xs"
          onClick={() => this.setState({ hasError: false, error: null })}
        >
          <RefreshCw className="w-3 h-3" /> Try again
        </Button>
      </div>
    );
  }
}
