import React, { useRef, useMemo, useState, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { Revision, SessionStatus } from '../../shared/types.js';
import { Columns2, Link2, Unlink2, X, Send, Loader2, Edit3, Eye } from 'lucide-react';
import { marked } from 'marked';

interface DiffViewerProps {
  revisions: Revision[];
  currentRound: number;
  comparisonRound: number;
  onChangeComparisonRound: (round: number) => void;
  onClose: () => void;
  editor: any;
  status: SessionStatus;
  overallComment: string;
  onOverallCommentChange: (val: string) => void;
  onSubmitRevision: () => void;
  isSubmitting: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  revisions,
  currentRound,
  comparisonRound,
  onChangeComparisonRound,
  onClose,
  editor,
  status,
  overallComment,
  onOverallCommentChange,
  onSubmitRevision,
  isSubmitting,
}) => {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isSyncScroll, setIsSyncScroll] = useState(true);
  const [isRevisionPopoverOpen, setIsRevisionPopoverOpen] = useState(false);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  // Available rounds for comparison (exclude currentRound so user cannot select the same round)
  const availableComparisonRounds = useMemo(() => {
    return revisions.filter((r) => r.roundNumber !== currentRound);
  }, [revisions, currentRound]);

  // Retrieve content for selected comparison round
  const comparisonRevision = useMemo(() => {
    return (
      revisions.find((r) => r.roundNumber === comparisonRound) ||
      availableComparisonRounds[availableComparisonRounds.length - 1] ||
      revisions[0]
    );
  }, [revisions, comparisonRound, availableComparisonRounds]);

  // Convert comparison markdown to clean HTML without color coding
  const comparisonHtml = useMemo(() => {
    return marked.parse(comparisonRevision?.contentMarkdown || '') as string;
  }, [comparisonRevision]);

  // Auto-focus directive textarea when opened
  useEffect(() => {
    if (isRevisionPopoverOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isRevisionPopoverOpen]);

  // Handle outside click to close directive popover
  useEffect(() => {
    if (!isRevisionPopoverOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsRevisionPopoverOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isRevisionPopoverOpen]);

  // Listen for Escape key to close popover or exit diff
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRevisionPopoverOpen) {
          setIsRevisionPopoverOpen(false);
          return;
        }
        // If an inline comment popover isn't active, close diff
        const popover = document.querySelector('.pujangga-popover');
        if (!popover) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isRevisionPopoverOpen]);

  // Synced scroll listeners
  const handleLeftScroll = () => {
    if (!isSyncScroll) return;
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    const maxScrollLeft = left.scrollHeight - left.clientHeight;
    if (maxScrollLeft <= 0) return;

    const scrollPercentage = left.scrollTop / maxScrollLeft;
    const maxScrollRight = right.scrollHeight - right.clientHeight;

    isSyncingRight.current = true;
    right.scrollTop = scrollPercentage * maxScrollRight;
  };

  const handleRightScroll = () => {
    if (!isSyncScroll) return;
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!left || !right) return;

    const maxScrollRight = right.scrollHeight - right.clientHeight;
    if (maxScrollRight <= 0) return;

    const scrollPercentage = right.scrollTop / maxScrollRight;
    const maxScrollLeft = left.scrollHeight - left.clientHeight;

    isSyncingLeft.current = true;
    left.scrollTop = scrollPercentage * maxScrollLeft;
  };

  const isRevising = status === 'revising';
  const isSatisfied = status === 'satisfied';

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF8F5] dark:bg-[#121110] flex flex-col transition-colors animate-in fade-in duration-150">
      {/* Top Floating Full-Width Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-white/95 dark:bg-[#181615]/95 border-b border-[#E6E0D4] dark:border-[#2C2825] flex items-center justify-between gap-4 backdrop-blur-md shrink-0 shadow-xs">
        {/* Left: Round Configuration */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 dark:bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Columns2 className="w-4 h-4" />
            </div>
            <span className="font-serif font-bold text-sm text-[#2C2825] dark:text-[#EDEAE4] hidden sm:inline">
              Side-by-Side Review
            </span>
          </div>

          <div className="h-4 w-px bg-[#DCD5C8] dark:bg-[#38332E] hidden sm:block" />

          {/* Comparison Round Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#706B65] dark:text-[#A8A29D]">
              Comparing against:
            </span>
            <select
              value={comparisonRevision?.roundNumber || comparisonRound}
              onChange={(e) => onChangeComparisonRound(Number(e.target.value))}
              disabled={availableComparisonRounds.length === 0}
              className="text-xs font-bold bg-[#FAF8F5] dark:bg-[#201D1B] border border-[#E6E0D4] dark:border-[#38332E] text-[#2C2825] dark:text-[#EDEAE4] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-2xs"
            >
              {availableComparisonRounds.map((r) => (
                <option key={r.roundNumber} value={r.roundNumber}>
                  Round {r.roundNumber} {r.roundNumber === currentRound - 1 ? '(Previous)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Synced Scroll Toggle */}
          <button
            type="button"
            onClick={() => setIsSyncScroll((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer select-none ${
              isSyncScroll
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-[#FAF8F5] dark:bg-[#1E1C1A] text-[#8C827A] dark:text-[#A8A29D] border-[#E6E0D4] dark:border-[#38332E]'
            }`}
            title={isSyncScroll ? 'Click to disable synced scroll' : 'Click to enable synced scroll'}
          >
            {isSyncScroll ? (
              <Link2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Unlink2 className="w-3.5 h-3.5 text-[#8C827A]" />
            )}
            <span className="hidden md:inline">Synced Scroll:</span>
            <span>{isSyncScroll ? 'ON' : 'OFF'}</span>
          </button>

          {/* Request Revision Button & Directive Popover */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setIsRevisionPopoverOpen((prev) => !prev)}
              disabled={isRevising || isSatisfied || isSubmitting}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                isRevisionPopoverOpen
                  ? 'bg-amber-700 text-white ring-2 ring-amber-500/50'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Request Revision</span>
            </button>

            {/* Overall Directive Popover */}
            {isRevisionPopoverOpen && (
              <div className="fixed sm:absolute right-4 sm:right-0 top-18 sm:top-full mt-2 w-[calc(100vw-2rem)] sm:w-104 bg-white dark:bg-[#1E1C1A] border border-[#E6E0D4] dark:border-[#38332E] rounded-2xl shadow-2xl p-4 z-60 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1] dark:border-[#2C2825]">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2C2825] dark:text-[#EDEAE4]">
                    <Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                    <span>Revision Directive (Round {currentRound})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRevisionPopoverOpen(false)}
                    className="p-1 rounded-lg text-[#8C827A] hover:text-[#2C2825] dark:hover:text-[#EDEAE4] hover:bg-[#F2EDE4] dark:hover:bg-[#2A2724] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#706B65] dark:text-[#A8A29D] uppercase tracking-wider mb-1.5">
                    Overall Instructions for AI Agent
                  </label>
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={overallComment}
                    onChange={(e) => onOverallCommentChange(e.target.value)}
                    placeholder="Provide overall guidance for the revision (e.g. improve opening hook, verify latency benchmarks, tighten prose)..."
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#161514] border border-[#E6E0D4] dark:border-[#38332E] text-[#2C2825] dark:text-[#EDEAE4] placeholder-[#A0988F] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSubmitRevision();
                        setIsRevisionPopoverOpen(false);
                      }
                    }}
                  />
                  <p className="text-[10px] text-[#A0988F] mt-1">
                    Tip: Press <kbd className="font-mono bg-[#EFEAE1] dark:bg-[#2C2825] px-1 py-0.5 rounded text-[9px]">⌘+Enter</kbd> to submit.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRevisionPopoverOpen(false)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DCD5C8] dark:border-[#38332E] text-[#635E59] dark:text-[#A8A29D] hover:bg-[#F5F2EB] dark:hover:bg-[#252220] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSubmitRevision();
                      setIsRevisionPopoverOpen(false);
                    }}
                    disabled={isSubmitting || isRevising}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Revision</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Close Diff Button */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2C2825] dark:bg-[#EDEAE4] text-white dark:text-[#121110] hover:opacity-90 text-xs font-semibold rounded-lg transition-opacity cursor-pointer shadow-xs"
            title="Exit diff mode (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Diff</span>
          </button>
        </div>
      </header>

      {/* Dual Column Side-by-Side Canvas Covering Full Viewport Width */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E6E0D4] dark:divide-[#2C2825] min-h-0 overflow-hidden">
        {/* Left Column: Current Draft (Editable & Commentable) */}
        <div className="flex flex-col min-h-0 h-full bg-white dark:bg-[#1A1816]">
          <div className="px-6 py-2.5 bg-[#FAF8F5]/90 dark:bg-[#151413]/90 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
              <span className="text-xs font-bold text-[#2C2825] dark:text-[#EDEAE4]">
                Round {currentRound} (Current Draft)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
              Live Editing & Notes Active
            </span>
          </div>

          <div
            ref={leftPaneRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-y-auto p-6 sm:p-10 md:p-14"
          >
            <div className="max-w-2xl mx-auto">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right Column: Historical Reference (Clean Rendered Markdown) */}
        <div className="flex flex-col min-h-0 h-full bg-[#FAF8F5]/40 dark:bg-[#141312]/40">
          <div className="px-6 py-2.5 bg-[#FAF8F5]/90 dark:bg-[#151413]/90 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-[#8C827A]" />
              <span className="text-xs font-bold text-[#706B65] dark:text-[#A8A29D]">
                Round {comparisonRevision?.roundNumber} (Reference)
              </span>
            </div>
            <span className="text-[11px] text-[#A0988F] uppercase tracking-wider font-semibold">
              Read-Only
            </span>
          </div>

          <div
            ref={rightPaneRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-y-auto p-6 sm:p-10 md:p-14"
          >
            <div className="max-w-2xl mx-auto">
              <div
                className="editorial-prose"
                dangerouslySetInnerHTML={{ __html: comparisonHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
