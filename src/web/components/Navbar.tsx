import React from 'react';
import {
  Feather,
  GitCompare,
  CheckSquare,
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
  resolvedCommentsCount: number;
  onOpenResolvedDrawer: () => void;
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
  resolvedCommentsCount,
  onOpenResolvedDrawer,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#FAF8F5]/90 dark:bg-[#121110]/90 border-b border-[#E6E0D4] dark:border-[#2C2825] px-6 py-3 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand & File Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Feather className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight font-serif text-[#2C2825] dark:text-[#E8E6E3]">
              Pujangga
            </span>
          </div>

          <div className="h-4 w-px bg-[#DCD5C8] dark:bg-[#38332E]" />

          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate text-[#2C2825] dark:text-[#E8E6E3]">
              {title}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EFEAE1] dark:bg-[#262320] text-[#706B65] dark:text-[#A8A29D]">
              Round {roundNumber}
            </span>
          </div>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          {status === 'revising' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 animate-pulse font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Agent is revising...</span>
            </div>
          ) : status === 'satisfied' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review Approved</span>
            </div>
          ) : null}
        </div>

        {/* Right: Controls & Toggles */}
        <div className="flex items-center gap-2">
          {hasPreviousRevision && (
            <button
              onClick={onToggleDiff}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showDiff
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white dark:bg-[#1C1A18] text-[#635E59] dark:text-[#A8A29D] border-[#E6E0D4] dark:border-[#38332E] hover:border-amber-500'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Revision Diff</span>
            </button>
          )}

          {resolvedCommentsCount > 0 && (
            <button
              onClick={onOpenResolvedDrawer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1C1A18] text-[#635E59] dark:text-[#A8A29D] border border-[#E6E0D4] dark:border-[#38332E] hover:border-amber-500 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
              <span>Audit ({resolvedCommentsCount})</span>
            </button>
          )}

          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-[#706B65] dark:text-[#A8A29D] hover:bg-[#EFEAE1] dark:hover:bg-[#262320] transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
