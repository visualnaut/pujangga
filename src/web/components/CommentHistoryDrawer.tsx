import React, { useMemo } from 'react';
import { InlineComment, Revision } from '../../shared/types.js';
import { History, X, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface CommentHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  comments: InlineComment[];
  revisions: Revision[];
  currentRound: number;
}

export interface AgentChangeInfo {
  status: 'pending' | 'revised' | 'unchanged';
  text: string;
  nextRoundNumber: number;
}

export function getAgentChangeForComment(
  comment: InlineComment,
  revisions: Revision[]
): AgentChangeInfo {
  const nextRound = comment.roundNumber + 1;
  const nextRev = revisions.find((r) => r.roundNumber === nextRound);

  if (!nextRev) {
    return {
      status: 'pending',
      text: `Waiting for agent to submit Round ${nextRound}...`,
      nextRoundNumber: nextRound,
    };
  }

  const currentRev = revisions.find((r) => r.roundNumber === comment.roundNumber);
  const oldText = currentRev?.contentMarkdown || '';
  const newText = nextRev.contentMarkdown || '';

  // If text remains verbatim
  if (newText.includes(comment.anchorText)) {
    return {
      status: 'unchanged',
      text: 'Text was kept unchanged in this revision.',
      nextRoundNumber: nextRound,
    };
  }

  // Find corresponding paragraph
  const oldParas = oldText.split(/\n\n+/);
  const targetIndex = oldParas.findIndex((p) => p.includes(comment.anchorText));
  const newParas = newText.split(/\n\n+/);

  if (targetIndex !== -1 && targetIndex < newParas.length) {
    const updatedPara = newParas[targetIndex].trim();
    if (updatedPara) {
      return {
        status: 'revised',
        text: updatedPara,
        nextRoundNumber: nextRound,
      };
    }
  }

  return {
    status: 'revised',
    text: 'Text was removed or restructured in this revision.',
    nextRoundNumber: nextRound,
  };
}

export const CommentHistoryDrawer: React.FC<CommentHistoryDrawerProps> = ({
  isOpen,
  onClose,
  comments,
  revisions,
  currentRound,
}) => {
  if (!isOpen) return null;

  // Sort comments by round and timestamp descending (most recent first)
  const sortedComments = [...comments].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#1A1816] h-full shadow-2xl flex flex-col border-l border-[#E6E0D4] dark:border-[#38332E]">
        {/* Header */}
        <div className="p-5 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#2C2825] dark:text-[#EDEAE4]">
                Comment History
              </h3>
              <p className="text-xs text-[#8C827A] dark:text-[#A8A29D]">
                Track what you commented and how the agent revised each section.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#2C2825] dark:hover:text-[#EDEAE4] hover:bg-[#F2EDE4] dark:hover:bg-[#2A2724] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sortedComments.length === 0 ? (
            <div className="py-16 text-center">
              <History className="w-10 h-10 mx-auto text-[#A0988F] mb-3 opacity-40" />
              <p className="text-sm font-medium text-[#706B65] dark:text-[#A8A29D]">
                No comments have been recorded yet.
              </p>
              <p className="text-xs text-[#A0988F] mt-1">
                Highlight text in the editor to attach inline review notes.
              </p>
            </div>
          ) : (
            sortedComments.map((comment) => {
              const agentChange = getAgentChangeForComment(comment, revisions);

              return (
                <div
                  key={comment.id}
                  className="bg-[#FAF8F5] dark:bg-[#201D1B] border border-[#EFEAE1] dark:border-[#332E2A] rounded-2xl p-4.5 space-y-3 transition-colors"
                >
                  {/* Round & Status Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/40">
                      Round {comment.roundNumber} Note
                    </span>
                    <span className="text-[11px] text-[#A0988F]">
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 1. Commented Text */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C827A] dark:text-[#A8A29D] block mb-1">
                      Commented Text
                    </span>
                    <div className="text-xs font-serif italic text-[#4A453F] dark:text-[#D6D0C5] bg-white dark:bg-[#161514] p-2.5 rounded-xl border border-[#E6E0D4] dark:border-[#2C2825]">
                      "{comment.anchorText}"
                    </div>
                  </div>

                  {/* 2. Reviewer Comment */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C827A] dark:text-[#A8A29D] block mb-1">
                      Your Critique / Directive
                    </span>
                    <div className="text-xs text-[#2C2825] dark:text-[#EDEAE4] bg-white dark:bg-[#161514] p-2.5 rounded-xl border border-[#E6E0D4] dark:border-[#2C2825] font-medium leading-relaxed">
                      {comment.commentText}
                    </div>
                  </div>

                  {/* 3. Agent's Change */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {agentChange.status === 'revised' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : agentChange.status === 'unchanged' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-[#8C827A]" />
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C827A] dark:text-[#A8A29D]">
                        Agent Change (Round {agentChange.nextRoundNumber})
                      </span>
                    </div>

                    <div
                      className={`text-xs p-2.5 rounded-xl border leading-relaxed ${
                        agentChange.status === 'revised'
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/40'
                          : agentChange.status === 'unchanged'
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/40'
                          : 'bg-white dark:bg-[#161514] text-[#8C827A] dark:text-[#A8A29D] border-[#E6E0D4] dark:border-[#2C2825] italic'
                      }`}
                    >
                      {agentChange.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0EBE1] dark:border-[#2C2825] bg-[#FAF8F5] dark:bg-[#141312] flex items-center justify-between text-xs text-[#8C827A]">
          <span>{comments.length} total note{comments.length !== 1 ? 's' : ''} across all rounds</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2C2825] dark:bg-[#EDEAE4] text-white dark:text-[#121110] font-semibold rounded-xl text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
