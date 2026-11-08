import React from 'react';
import { Sparkles, FolderKanban, Download, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentTab: 'create' | 'creations';
  onSelectTab: (tab: 'create' | 'creations') => void;
  onOpenExport?: () => void;
  canExport?: boolean;
  onResetWorkspace?: () => void;
  savedCreationsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenExport,
  canExport = false,
  onResetWorkspace,
  savedCreationsCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0b0d0e]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('create');
            }}
            className="group flex items-center gap-2.5 text-base font-bold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-[#16181a] font-mono text-xs font-semibold text-[#00e599] shadow-inner">
              MX
            </span>
            <span className="font-sans text-sm tracking-widest uppercase">
              MXM CREATOR
            </span>
          </a>
        </div>

        {/* Zone 2: Navigation (Exactly 2 primary items: CREATE LOOK, MY CREATIONS) */}
        <nav className="flex items-center gap-8 text-xs font-medium uppercase tracking-wider">
          <button
            type="button"
            onClick={() => onSelectTab('create')}
            className={`relative py-4 whitespace-nowrap transition-colors ${
              currentTab === 'create'
                ? 'text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Create Look
            {currentTab === 'create' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00e599]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('creations')}
            className={`relative py-4 whitespace-nowrap transition-colors flex items-center gap-2 ${
              currentTab === 'creations'
                ? 'text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            My Creations
            {savedCreationsCount > 0 && (
              <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                ({savedCreationsCount})
              </span>
            )}
            {currentTab === 'creations' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00e599]" />
            )}
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {onResetWorkspace && currentTab === 'create' && (
            <button
              type="button"
              onClick={onResetWorkspace}
              title="Reset workspace to start fresh"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] rounded transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {canExport && onOpenExport && (
            <button
              type="button"
              onClick={onOpenExport}
              className="inline-flex items-center gap-2 rounded bg-[#00e599] px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:bg-[#00ffaa] hover:shadow-[0_0_15px_rgba(0,229,153,0.3)] whitespace-nowrap active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Export Studio</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
