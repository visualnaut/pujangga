import React from 'react';
import {
  Feather,
  Columns2,
  History,
  Sun,
  Moon,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface NavbarProps {
  title: string;
  filePath: string;
  roundNumber: number;
  status: SessionStatus;
  showDiff: boolean;
  onToggleDiff: () => void;
  hasPreviousRevision: boolean;
  totalCommentsCount: number;
  onOpenCommentHistory: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  filePath,
  roundNumber,
  status,
  showDiff,
  onToggleDiff,
  hasPreviousRevision,
  totalCommentsCount,
  onOpenCommentHistory,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-paper/90 dark:bg-night/90 border-b border-paper-border dark:border-night-border px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand & File Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent dark:bg-accent-pin text-white flex items-center justify-center shadow-xs">
              <Feather className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight font-serif text-ink dark:text-night-text-heading">
              Pujangga
            </span>
          </div>

          <div className="h-4 w-px bg-paper-divider dark:bg-night-border-strong" />

          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate text-ink dark:text-night-text-heading">
              {title}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted">
              Round {roundNumber}
            </span>
          </div>
        </div>

        {/* Center: Status Indicator */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          {status === 'satisfied' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-subtle dark:bg-success-subtle-dark text-success-text dark:text-success-text-dark font-medium border border-success-border dark:border-success-border-dark">
              <CheckCircle2 className="w-3.5 h-3.5 text-success-icon dark:text-success-icon-dark" />
              <span>Review Approved</span>
            </div>
          )}
        </div>

        {/* Right: Controls & Toggles */}
        <div className="flex items-center gap-2">
          {hasPreviousRevision && (
            <button
              onClick={onToggleDiff}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                showDiff
                  ? 'bg-accent text-white border-accent shadow-xs'
                  : 'bg-paper-card dark:bg-night-modal text-ink-body dark:text-night-text-muted border-paper-border dark:border-night-border-strong hover:border-accent-pin'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Side-by-Side Diff</span>
            </button>
          )}

          {totalCommentsCount > 0 && (
            <button
              onClick={onOpenCommentHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-paper-card dark:bg-night-modal text-ink-body dark:text-night-text-muted border border-paper-border dark:border-night-border-strong hover:border-accent-pin transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-accent dark:text-accent-pin" />
              <span>Comment History ({totalCommentsCount})</span>
            </button>
          )}

          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-ink-muted dark:text-night-text-muted hover:bg-paper-subtle dark:hover:bg-night-subtle transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
