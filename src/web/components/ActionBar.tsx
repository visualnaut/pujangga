import React from 'react';
import { Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface ActionBarProps {
  status: SessionStatus;
  roundNumber: number;
  overallComment: string;
  onOverallCommentChange: (val: string) => void;
  onSubmitRevision: () => void;
  onApprove: () => void;
  isSubmitting: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  status,
  roundNumber,
  overallComment,
  onOverallCommentChange,
  onSubmitRevision,
  onApprove,
  isSubmitting,
}) => {
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 lg:hidden backdrop-blur-md bg-paper/95 dark:bg-night/95 border-t border-paper-border dark:border-night-border p-3 sm:p-4 transition-colors shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
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
                : 'Overall directive for agent...'
            }
            className="w-full text-sm bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong rounded-xl px-4 py-2 text-ink dark:text-night-text-heading placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs disabled:opacity-60 transition-all"
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
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
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
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
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
