import React, { useState, useEffect } from 'react';
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
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (shouldRender) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [shouldRender]);

  if (!shouldRender) return null;

  // Sort comments by round and timestamp descending (most recent first)
  const sortedComments = [...comments].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div
      className={`fixed inset-0 z-70 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity duration-250 ease-out ${
        isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`w-full max-w-xl bg-paper-card dark:bg-night-card h-full shadow-2xl flex flex-col border-l border-paper-border dark:border-night-border-strong transform transition-transform duration-250 ease-out ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-paper-border-light dark:border-night-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-subtle dark:bg-accent-subtle-dark text-accent dark:text-accent-pin flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink dark:text-night-text">
                Comment History
              </h3>
              <p className="text-sm text-ink-subtle dark:text-night-text-muted">
                Track what you commented and how the agent revised each section.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-ink-subtle hover:text-ink dark:hover:text-night-text hover:bg-paper-hover dark:hover:bg-night-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sortedComments.length === 0 ? (
            <div className="py-16 text-center">
              <History className="w-10 h-10 mx-auto text-ink-faint mb-3 opacity-40" />
              <p className="text-sm font-medium text-ink-muted dark:text-night-text-muted">
                No comments have been recorded yet.
              </p>
              <p className="text-sm text-ink-faint mt-1">
                Highlight text in the editor to attach inline review notes.
              </p>
            </div>
          ) : (
            sortedComments.map((comment) => {
              const agentChange = getAgentChangeForComment(comment, revisions);

              return (
                <div
                  key={comment.id}
                  className="bg-paper dark:bg-night-input border border-paper-border-subtle dark:border-night-border-subtle rounded-2xl p-4.5 space-y-3 transition-colors"
                >
                  {/* Round & Status Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wider text-accent-text dark:text-accent-text-dark bg-accent-subtle dark:bg-accent-subtle-dark px-2.5 py-0.5 rounded-md border border-accent-border dark:border-accent-border-dark">
                      Round {comment.roundNumber} Note
                    </span>
                    <span className="text-sm text-ink-faint">
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 1. Commented Text */}
                  <div>
                    <span className="text-sm font-semibold uppercase tracking-wider text-ink-subtle dark:text-night-text-muted block mb-1">
                      Commented Text
                    </span>
                    <div className="text-sm font-serif italic text-ink-secondary dark:text-night-text-quote bg-paper-card dark:bg-night-darker p-2.5 rounded-xl border border-paper-border dark:border-night-border">
                      "{comment.anchorText}"
                    </div>
                  </div>

                  {/* 2. Reviewer Comment */}
                  <div>
                    <span className="text-sm font-semibold uppercase tracking-wider text-ink-subtle dark:text-night-text-muted block mb-1">
                      Your Critique / Directive
                    </span>
                    <div className="text-sm text-ink dark:text-night-text bg-paper-card dark:bg-night-darker p-2.5 rounded-xl border border-paper-border dark:border-night-border font-medium leading-relaxed">
                      {comment.commentText}
                    </div>
                  </div>

                  {/* 3. Agent's Change */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {agentChange.status === 'revised' ? (
                        <CheckCircle2 className="w-4 h-4 text-success-icon dark:text-success-icon-dark" />
                      ) : agentChange.status === 'unchanged' ? (
                        <AlertCircle className="w-4 h-4 text-accent dark:text-accent-pin" />
                      ) : (
                        <Clock className="w-4 h-4 text-ink-subtle" />
                      )}
                      <span className="text-sm font-semibold uppercase tracking-wider text-ink-subtle dark:text-night-text-muted">
                        Agent Change (Round {agentChange.nextRoundNumber})
                      </span>
                    </div>

                    <div
                      className={`text-sm p-2.5 rounded-xl border leading-relaxed ${
                        agentChange.status === 'revised'
                          ? 'bg-success-subtle dark:bg-success-subtle-dark text-success-text dark:text-success-text-dark border-success-border dark:border-success-border-dark'
                          : agentChange.status === 'unchanged'
                          ? 'bg-accent-subtle dark:bg-accent-subtle-dark text-accent-text dark:text-accent-text-dark border-accent-border dark:border-accent-border-dark'
                          : 'bg-paper-card dark:bg-night-darker text-ink-subtle dark:text-night-text-muted border-paper-border dark:border-night-border italic'
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
        <div className="p-4 border-t border-paper-border-light dark:border-night-border bg-paper dark:bg-night-surface flex items-center justify-between text-sm text-ink-subtle">
          <span>{comments.length} total note{comments.length !== 1 ? 's' : ''} across all rounds</span>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-ink dark:bg-night-text text-white dark:text-night font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
