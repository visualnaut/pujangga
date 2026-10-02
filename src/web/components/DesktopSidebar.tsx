import React from 'react';
import { Send, CheckCircle2, Loader2, Sparkles, MessageSquare, Edit3, ArrowRight } from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface DesktopSidebarProps {
  status: SessionStatus;
  roundNumber: number;
  inlineCommentsCount: number;
  hasDirectEdits: boolean;
  overallComment: string;
  onOverallCommentChange: (val: string) => void;
  onSubmitRevision: () => void;
  onApprove: () => void;
  isSubmitting: boolean;
  resolvedCommentsCount: number;
  onOpenResolvedDrawer: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  status,
  roundNumber,
  inlineCommentsCount,
  hasDirectEdits,
  overallComment,
  onOverallCommentChange,
  onSubmitRevision,
  onApprove,
  isSubmitting,
  resolvedCommentsCount,
  onOpenResolvedDrawer,
}) => {
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  return (
    <aside className="hidden lg:flex flex-col w-84 shrink-0 sticky top-20 gap-4">
      {/* Editorial Review & Directives Panel */}
      <div className="bg-white dark:bg-[#1A1816] rounded-2xl border border-[#E6E0D4] dark:border-[#38332E] p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F0EBE1] dark:border-[#2C2825]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#706B65] dark:text-[#A8A29D]">
            Editorial Directives
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#EFEAE1] dark:bg-[#262320] text-[#706B65] dark:text-[#A8A29D]">
            Round {roundNumber}
          </span>
        </div>

        {/* State Banners */}
        {isRevising ? (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-850 flex items-start gap-3">
            <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold block mb-0.5">Agent is Revising...</span>
              Keep this tab open. It will automatically re-render when Round {roundNumber + 1} arrives.
            </div>
          </div>
        ) : isSatisfied ? (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <span className="font-semibold block mb-0.5">Writing Approved!</span>
              The target file on disk contains your approved text. The review loop has completed.
            </div>
          </div>
        ) : null}

        {/* Notes Summary Pills */}
        <div className="flex items-center gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-[#201D1B] border border-[#EFEAE1] dark:border-[#332E2A] text-[#706B65] dark:text-[#A8A29D]">
            <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
            <span>{inlineCommentsCount} inline note{inlineCommentsCount !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-[#201D1B] border border-[#EFEAE1] dark:border-[#332E2A] text-[#706B65] dark:text-[#A8A29D]">
            <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
            <span>Direct edits auto-sync</span>
          </div>
        </div>

        {/* Overall Directive Textarea */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-[#706B65] dark:text-[#A8A29D] mb-1.5">
            Overall Directive for Agent
          </label>
          <textarea
            rows={5}
            value={overallComment}
            onChange={(e) => onOverallCommentChange(e.target.value)}
            disabled={isRevising || isSatisfied || isSubmitting}
            placeholder={
              isSatisfied
                ? 'Review concluded.'
                : isRevising
                ? `Waiting for revision...`
                : 'Write your overarching feedback, tone corrections, or directives here... (Cmd+Enter to send)'
            }
            className="w-full text-sm bg-[#FAF8F5] dark:bg-[#151413] border border-[#E6E0D4] dark:border-[#38332E] rounded-xl p-3 text-[#2C2825] dark:text-[#EDEAE4] placeholder-[#A0988F] focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none shadow-xs disabled:opacity-60 transition-all leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmitRevision();
              }
            }}
          />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onSubmitRevision}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Request Revision ↵</span>
          </button>

          <button
            onClick={onApprove}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSatisfied ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Satisfied & Finalize ✨</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-[#F0EBE1] dark:border-[#2C2825] text-center">
          <span className="text-[11px] text-[#A0988F]">
            Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#201D1B] border border-[#E6E0D4] dark:border-[#38332E]">⌘ + ↵</kbd> to submit
          </span>
        </div>
      </div>

      {/* Resolved Comments Quick Access */}
      {resolvedCommentsCount > 0 && (
        <button
          onClick={onOpenResolvedDrawer}
          className="flex items-center justify-between p-3.5 bg-white dark:bg-[#1A1816] rounded-xl border border-[#E6E0D4] dark:border-[#38332E] hover:border-amber-500/50 text-xs font-medium text-[#706B65] dark:text-[#A8A29D] shadow-xs transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            <span>Audit Past Comments ({resolvedCommentsCount})</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
};
