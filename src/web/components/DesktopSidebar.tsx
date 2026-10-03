import React from 'react';
import { SendHorizonal, CheckCircle2, Loader2, BookCheck, History, Lock, FileText, Clock } from 'lucide-react';
import { useEditorState, type Editor } from '@tiptap/react';
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
  totalLockedCount?: number;
  onOpenCommentHistory: () => void;
  onOpenLockedTexts: () => void;
  editor?: Editor | null;
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
  totalLockedCount = 0,
  onOpenCommentHistory,
  onOpenLockedTexts,
  editor,
}) => {
  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  const stats = useEditorState({
    editor: editor ?? null,
    selector: (ctx) => {
      if (!ctx.editor || !ctx.editor.state) {
        return { words: 0, readingDuration: '0 min read' };
      }
      const text = ctx.editor.getText();
      const trimmed = text.trim();
      const count = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
      const minutes = Math.ceil(count / 200);
      const readingDuration =
        count === 0 ? '0 min read' : count < 200 ? '< 1 min read' : `~${minutes} min read`;
      return { words: count, readingDuration };
    },
  }) || { words: 0, readingDuration: '0 min read' };

  return (
    <aside className="hidden lg:flex flex-col w-84 shrink-0 sticky top-20 gap-4">
      {/* Editorial Review & Directives Panel */}
      <div className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong p-5 shadow-xs transition-colors rounded-lg">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-paper-border-light dark:border-night-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted dark:text-night-text-muted">
            Brainstorm Session
          </h3>
          <span className="text-sm px-2.5 py-0.5 rounded-full font-medium bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted">
            Round {roundNumber}
          </span>
        </div>

        {/* Document Stats & Telemetry */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-muted dark:text-night-text-muted mb-1.5">
            Document Stats
          </label>
          <div className="p-3 bg-paper dark:bg-night-pane border border-paper-border dark:border-night-border rounded-xl space-y-2.5">
            {/* Live Content Telemetry */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-ink dark:text-night-text font-medium">
                <FileText className="w-4 h-4 text-ink-muted dark:text-night-text-muted" />
                <span>
                  {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-ink-muted dark:text-night-text-muted">
                <Clock className="w-4 h-4" />
                <span>{stats.readingDuration}</span>
              </div>
            </div>

            {/* Locked & Noted Text Buttons & Info */}
            <div className="pt-2 border-t border-paper-border-light dark:border-night-border grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenCommentHistory}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong hover:border-accent/50 text-xs font-medium text-ink dark:text-night-text transition-colors cursor-pointer group shadow-2xs"
                title={`View review notes history (${totalCommentsCount})`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <History className="w-3.5 h-3.5 text-accent dark:text-accent-pin shrink-0" />
                  <span className="truncate">Notes</span>
                </div>
                <span
                  className={`shrink-0 ml-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    totalCommentsCount > 0
                      ? 'bg-accent-subtle dark:bg-accent-subtle-dark text-accent-text dark:text-accent-text-dark border border-accent-border dark:border-accent-border-dark'
                      : 'bg-paper-subtle dark:bg-night-subtle text-ink-faint'
                  }`}
                >
                  {totalCommentsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenLockedTexts}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong hover:border-success/50 text-xs font-medium text-ink dark:text-night-text transition-colors cursor-pointer group shadow-2xs"
                title={`View locked text segments (${totalLockedCount})`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-success dark:text-success-icon-dark shrink-0" />
                  <span className="truncate">Locked</span>
                </div>
                <span
                  className={`shrink-0 ml-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    totalLockedCount > 0
                      ? 'bg-success-subtle dark:bg-success-subtle-dark text-success-text dark:text-success-text-dark border border-success-border dark:border-success-border-dark'
                      : 'bg-paper-subtle dark:bg-night-subtle text-ink-faint'
                  }`}
                >
                  {totalLockedCount}
                </span>
              </button>
            </div>
          </div>
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
      </div>
    </aside>
  );
};
