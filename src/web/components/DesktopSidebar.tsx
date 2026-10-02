import React from 'react';
import { SendHorizonal, CheckCircle2, Loader2, BookCheck, History, ArrowRight } from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface DesktopSidebarProps {
  status: SessionStatus;
  roundNumber: number;
  overallComment: string;
  onOverallCommentChange: (val: string) => void;
  onSubmitRevision: () => boolean | void;
  onApprove: () => void;
  isSubmitting: boolean;
  totalCommentsCount: number;
  onOpenCommentHistory: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  status,
  roundNumber,
  overallComment,
  onOverallCommentChange,
  onSubmitRevision,
  onApprove,
  isSubmitting,
  totalCommentsCount,
  onOpenCommentHistory,
}) => {
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  return (
    <aside className="hidden lg:flex flex-col w-84 shrink-0 sticky top-20 gap-4">
      {/* Editorial Review & Directives Panel */}
      <div className="bg-paper-card dark:bg-night-card rounded-2xl border border-paper-border dark:border-night-border-strong p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-paper-border-light dark:border-night-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted dark:text-night-text-muted">
            Brainstorm Session
          </h3>
          <span className="text-sm px-2.5 py-0.5 rounded-full font-medium bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted">
            Round {roundNumber}
          </span>
        </div>

        {/* State Banners */}
        {isRevising ? (
          <div className="mb-4 p-3.5 rounded-xl bg-accent-subtle dark:bg-accent-subtle-dark border border-accent-border dark:border-accent-border-dark flex items-start gap-3">
            <Loader2 className="w-4 h-4 text-accent dark:text-accent-pin animate-spin mt-0.5 shrink-0" />
            <div className="text-sm text-accent-text dark:text-accent-text-dark">
              <span className="font-semibold block mb-0.5">Agent is Revising...</span>
              Keep this tab open. It will automatically re-render when Round {roundNumber + 1} arrives.
            </div>
          </div>
        ) : isSatisfied ? (
          <div className="mb-4 p-3.5 rounded-xl bg-success-subtle dark:bg-success-subtle-dark border border-success-border dark:border-success-border-dark flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-success-icon dark:text-success-icon-dark mt-0.5 shrink-0" />
            <div className="text-sm text-success-text dark:text-success-text-dark">
              <span className="font-semibold block mb-0.5">Writing Approved!</span>
              The target file on disk contains your approved text. The review loop has completed.
            </div>
          </div>
        ) : null}

        {/* Directive Textarea */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-muted dark:text-night-text-muted mb-1.5">
            Directive for Agent
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
            className="w-full text-sm bg-paper dark:bg-night-pane border border-paper-border dark:border-night-border-strong rounded-xl p-3 text-ink dark:text-night-text placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none shadow-xs disabled:opacity-60 transition-all leading-relaxed"
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
            <span>Request Revision</span>
          </button>

          <button
            onClick={onApprove}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-success hover:bg-success-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSatisfied ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <BookCheck className="w-4 h-4" />
            )}
            <span>Finalize Draft</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-paper-border-light dark:border-night-border text-center">
          <span className="text-sm text-ink-faint">
            Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-paper dark:bg-night-input border border-paper-border dark:border-night-border-strong text-sm">⌘ + ↵</kbd> to submit
          </span>
        </div>
      </div>

      {/* Comment History Quick Access */}
      {totalCommentsCount > 0 && (
        <button
          onClick={onOpenCommentHistory}
          className="flex items-center justify-between p-3.5 bg-paper-card dark:bg-night-card rounded-xl border border-paper-border dark:border-night-border-strong hover:border-accent-pin/50 text-sm font-semibold text-ink-muted dark:text-night-text-muted shadow-xs transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent dark:text-accent-pin" />
            <span>Comment History ({totalCommentsCount})</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
};
