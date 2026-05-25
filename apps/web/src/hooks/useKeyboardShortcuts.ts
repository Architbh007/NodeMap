import { useEffect, useCallback } from 'react';
import { useGraphStore } from '@/store/graphStore';

interface Options {
  onFocusSearch?: () => void;
  onFitView?: () => void;
}

export function useKeyboardShortcuts({ onFocusSearch, onFitView }: Options = {}) {
  const { selectNode, clearHighlight, setSearchQuery, setActivePanel } = useGraphStore();

  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable;

    if (e.key === 'Escape') {
      selectNode(null);
      clearHighlight();
      setSearchQuery('');
      setActivePanel(null);
      return;
    }

    if (inInput) return;

    if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      onFocusSearch?.();
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onFitView?.();
    }
  }, [selectNode, clearHighlight, setSearchQuery, setActivePanel, onFocusSearch, onFitView]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
