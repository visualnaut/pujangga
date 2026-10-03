import React from 'react';
import {
  Columns2,
  History,
  Sun,
  Moon,
  Loader2,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Lock,
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
  totalLockedCount?: number;
  onOpenLockedTexts?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isZenMode: boolean;
  isDeepZen?: boolean;
  hasZenStarted?: boolean;
  onToggleZenMode: () => void;
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
  totalLockedCount = 0,
  onOpenLockedTexts,
  isDark,
  onToggleTheme,
  isZenMode,
  isDeepZen = false,
  hasZenStarted = false,
  onToggleZenMode,
}) => {
  return (
    <header
      className={`sticky top-0 z-40 w-full bg-white dark:bg-night px-6 py-3 transition-colors relative overflow-hidden ${
        isZenMode ? 'pointer-events-none select-none' : ''
      }`}
    >
      {/* Bottom Border Line (Inside header so it is covered by the veil in Ananta Toer Mode) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-paper-border dark:bg-night-border pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Internal Dimming Veil in Ananta Toer Mode */}
      <div
        className={`absolute inset-0 bg-black pointer-events-none z-20 ${
          isZenMode
            ? isDeepZen
              ? 'opacity-90 zen-veil-deep'
              : 'opacity-50 zen-veil-initial'
            : hasZenStarted
            ? 'opacity-0 zen-veil-exit'
            : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 relative z-10">
        {/* Left: Brand & File Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <img
              src="/pujangga.png"
              alt="Pujangga logo"
              className="w-8 h-8 rounded-lg object-contain shadow-xs"
            />
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
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-paper-card dark:bg-night-modal text-ink-body dark:text-night-text-muted border border-paper-border dark:border-night-border-strong hover:border-accent-pin transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-accent dark:text-accent-pin" />
              <span>Comments ({totalCommentsCount})</span>
            </button>
          )}

          {totalLockedCount > 0 && onOpenLockedTexts && (
            <button
              onClick={onOpenLockedTexts}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-paper-card dark:bg-night-modal text-ink-body dark:text-night-text-muted border border-paper-border dark:border-night-border-strong hover:border-success/50 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-success dark:text-success-icon-dark" />
              <span>Locked ({totalLockedCount})</span>
            </button>
          )}

          {/* Ananta Toer Mode Toggle */}
          <button
            onClick={onToggleZenMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              isZenMode
                ? 'bg-accent text-white border-accent shadow-xs'
                : 'bg-paper-card dark:bg-night-modal text-ink-body dark:text-night-text-muted border-paper-border dark:border-night-border-strong hover:border-accent-pin'
            }`}
            title={isZenMode ? 'Exit Ananta Toer Mode (Esc)' : 'Ananta Toer Mode (distraction-free writing)'}
          >
            {isZenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Ananta Toer Mode</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ananta Toer Mode</span>
              </>
            )}
          </button>

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
