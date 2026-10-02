import React, { useRef, useMemo } from 'react';
import { Revision } from '../../shared/types.js';
import { Columns2, ArrowRight, X, Sparkles } from 'lucide-react';
import { marked } from 'marked';

interface DiffViewerProps {
  revisions: Revision[];
  selectedLeftRound: number;
  selectedRightRound: number;
  onSelectLeftRound: (round: number) => void;
  onSelectRightRound: (round: number) => void;
  onClose: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  revisions,
  selectedLeftRound,
  selectedRightRound,
  onSelectLeftRound,
  onSelectRightRound,
  onClose,
}) => {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  // Retrieve content for selected rounds
  const leftRevision = useMemo(() => {
    return revisions.find((r) => r.roundNumber === selectedLeftRound) || revisions[0];
  }, [revisions, selectedLeftRound]);

  const rightRevision = useMemo(() => {
    return (
      revisions.find((r) => r.roundNumber === selectedRightRound) ||
      revisions[revisions.length - 1]
    );
  }, [revisions, selectedRightRound]);

  // Convert markdown to clean HTML without any color highlighting
  const leftHtml = useMemo(() => {
    return marked.parse(leftRevision?.contentMarkdown || '') as string;
  }, [leftRevision]);

  const rightHtml = useMemo(() => {
    return marked.parse(rightRevision?.contentMarkdown || '') as string;
  }, [rightRevision]);

  // Synced scroll listeners
  const handleLeftScroll = () => {
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

  return (
    <div className="bg-white dark:bg-[#1A1816] rounded-2xl border border-[#E6E0D4] dark:border-[#38332E] shadow-sm flex flex-col transition-colors overflow-hidden">
      {/* Diff Controls Header */}
      <div className="p-4 sm:p-5 border-b border-[#F0EBE1] dark:border-[#2C2825] bg-[#FAF8F5]/80 dark:bg-[#151413]/80 flex flex-wrap items-center justify-between gap-4">
        {/* Left & Right Round Pickers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <Columns2 className="w-4 h-4" />
            <span className="hidden sm:inline">Side-by-Side</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Left Round Select */}
            <select
              value={selectedLeftRound}
              onChange={(e) => onSelectLeftRound(Number(e.target.value))}
              className="text-xs font-semibold bg-white dark:bg-[#201D1B] border border-[#E6E0D4] dark:border-[#38332E] text-[#2C2825] dark:text-[#EDEAE4] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-2xs"
            >
              {revisions.map((r) => (
                <option key={r.roundNumber} value={r.roundNumber}>
                  Round {r.roundNumber}
                </option>
              ))}
            </select>

            <span className="text-xs text-[#8C827A] font-medium">vs</span>

            {/* Right Round Select */}
            <select
              value={selectedRightRound}
              onChange={(e) => onSelectRightRound(Number(e.target.value))}
              className="text-xs font-semibold bg-white dark:bg-[#201D1B] border border-[#E6E0D4] dark:border-[#38332E] text-[#2C2825] dark:text-[#EDEAE4] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-2xs"
            >
              {revisions.map((r) => (
                <option key={r.roundNumber} value={r.roundNumber}>
                  Round {r.roundNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Synced Scroll Badge & Close */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-[11px] text-[#8C827A] dark:text-[#A8A29D]">
            Synced scroll active
          </span>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#201D1B] hover:bg-[#F2EDE4] dark:hover:bg-[#2A2724] border border-[#E6E0D4] dark:border-[#38332E] text-xs font-medium text-[#706B65] dark:text-[#EDEAE4] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Diff</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Scrollable Panes */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F0EBE1] dark:divide-[#2C2825] h-[75vh]">
        {/* Left Pane (Round A) */}
        <div className="flex flex-col min-h-0 h-full">
          <div className="px-6 py-2.5 bg-[#FAF8F5]/50 dark:bg-[#141312]/50 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between text-xs font-semibold text-[#8C827A] dark:text-[#A8A29D]">
            <span>Round {selectedLeftRound}</span>
            <span className="text-[10px] uppercase tracking-wider text-[#A0988F]">Base Version</span>
          </div>
          <div
            ref={leftPaneRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10"
          >
            <div
              className="editorial-prose"
              dangerouslySetInnerHTML={{ __html: leftHtml }}
            />
          </div>
        </div>

        {/* Right Pane (Round B) */}
        <div className="flex flex-col min-h-0 h-full">
          <div className="px-6 py-2.5 bg-[#FAF8F5]/50 dark:bg-[#141312]/50 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between text-xs font-semibold text-[#8C827A] dark:text-[#A8A29D]">
            <span>Round {selectedRightRound}</span>
            <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-500">
              Target Version
            </span>
          </div>
          <div
            ref={rightPaneRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10"
          >
            <div
              className="editorial-prose"
              dangerouslySetInnerHTML={{ __html: rightHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
