import React from 'react';
import { Send, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface ActionBarProps {
  status: SessionStatus;
  roundNumber: number;
  overallComment: string;
  onOverallCommentChange: (val: string) => void;
  onSubmitRevision: () => boolean | void;
  onApprove: () => void;
  isSubmitting: boolean;
  revisionAlert?: string | null;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  status,
  roundNumber,
  overallComment,
  onOverallCommentChange,
  onSubmitRevision,
  onApprove,
  isSubmitting,
  revisionAlert,
}) => {
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 lg:hidden backdrop-blur-md bg-paper/95 dark:bg-night/95 border-t border-paper-border dark:border-night-border p-3 sm:p-4 transition-colors shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
        {/* Revision Alert Warning Banner */}
        {revisionAlert && (
          <div className="text-sm text-accent-text dark:text-accent-text-dark bg-accent-subtle dark:bg-accent-subtle-dark border border-accent-border dark:border-accent-border-dark px-3 py-1.5 rounded-lg flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-accent dark:text-accent-pin shrink-0" />
            <span className="truncate">Add an inline note or write a directive first.</span>
          </div>
        )}

        {/* Overall Directive Input */}
        <div className="relative w-full">
          <input
            type="text"
            value={overallComment}
            onChange={(e) => onOverallCommentChange(e.target.value)}
            disabled={isRevising || isSatisfied || isSubmitting}
            placeholder={
              isSatisfied
                ? 'Review concluded. Writing marked as Satisfied.'
                : isRevising
                ? `Waiting for agent to revise Round ${roundNumber + 1}...`
                : 'Directive for agent...'
            }
            className="w-full text-sm bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong rounded-xl px-4 py-2 text-ink dark:text-night-text-heading placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-xs disabled:opacity-60 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSubmitRevision();
              }
            }}
          />

        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onSubmitRevision}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Request Revision</span>
          </button>

          <button
            onClick={onApprove}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-success hover:bg-success-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSatisfied ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Satisfied ✨</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
