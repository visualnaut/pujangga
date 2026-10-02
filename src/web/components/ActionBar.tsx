import React, { useState } from 'react';
import { Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { SessionStatus } from '../../shared/types.js';

interface ActionBarProps {
  status: SessionStatus;
  roundNumber: number;
  inlineCommentsCount: number;
  hasDirectEdits: boolean;
  onSubmitRevision: (overallComment: string) => void;
  onApprove: (finalNote: string) => void;
  isSubmitting: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  status,
  roundNumber,
  inlineCommentsCount,
  hasDirectEdits,
  onSubmitRevision,
  onApprove,
  isSubmitting,
}) => {
  const [overallComment, setOverallComment] = useState('');
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  const handleRequestRevision = () => {
    onSubmitRevision(overallComment);
    setOverallComment('');
  };

  const handleApprove = () => {
    onApprove(overallComment);
  };

  return (
    <footer className="sticky bottom-0 z-40 w-full backdrop-blur-md bg-[#FAF8F5]/95 dark:bg-[#121110]/95 border-t border-[#E6E0D4] dark:border-[#2C2825] p-4 transition-colors">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
        {/* Overall Directive Input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            disabled={isRevising || isSatisfied || isSubmitting}
            placeholder={
              isSatisfied
                ? 'Review concluded. Writing marked as Satisfied.'
                : isRevising
                ? 'Waiting for agent to submit Round ' + (roundNumber + 1) + '...'
                : 'Overall directive for the agent (e.g. Tone down hyperbole in section 2)...'
            }
            className="w-full text-sm bg-white dark:bg-[#1A1816] border border-[#E6E0D4] dark:border-[#38332E] rounded-xl px-4 py-2.5 text-[#2C2825] dark:text-[#E8E6E3] placeholder-[#A0988F] focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs disabled:opacity-60 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleRequestRevision();
              }
            }}
          />
          {inlineCommentsCount > 0 && !isRevising && !isSatisfied && (
            <span className="absolute right-3 top-2.5 text-[11px] font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              {inlineCommentsCount} note{inlineCommentsCount > 1 ? 's' : ''} attached
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Request Revision Button */}
          <button
            onClick={handleRequestRevision}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Request Revision</span>
          </button>

          {/* Satisfied / Finalize Button */}
          <button
            onClick={handleApprove}
            disabled={isRevising || isSatisfied || isSubmitting}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isSatisfied ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Satisfied ✨</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
