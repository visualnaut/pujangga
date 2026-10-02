import React, { useMemo } from 'react';
import { computeWordDiff, summarizeDiff } from '../../shared/diff.js';
import { GitCompare, Plus, Minus } from 'lucide-react';

interface DiffViewerProps {
  previousMarkdown: string;
  currentMarkdown: string;
  roundNumber: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  previousMarkdown,
  currentMarkdown,
  roundNumber,
}) => {
  const diffParts = useMemo(() => {
    return computeWordDiff(previousMarkdown || '', currentMarkdown || '');
  }, [previousMarkdown, currentMarkdown]);

  const summary = useMemo(() => {
    return summarizeDiff(previousMarkdown || '', currentMarkdown || '');
  }, [previousMarkdown, currentMarkdown]);

  if (!previousMarkdown) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E6E0D4] dark:border-[#38332E]">
        <GitCompare className="w-8 h-8 mx-auto text-[#A0988F] mb-2" />
        <p className="text-sm font-medium text-[#706B65] dark:text-[#A8A29D]">
          Round 1 has no previous revision to compare against.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E6E0D4] dark:border-[#38332E] p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#F0EBE1] dark:border-[#2C2825]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-amber-600 dark:text-amber-500" />
          <h3 className="font-semibold text-base text-[#2C2825] dark:text-[#E8E6E3]">
            Agent Revisions (Round {roundNumber - 1} → Round {roundNumber})
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded">
            <Plus className="w-3.5 h-3.5" />
            {summary.addedCount} words added
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded">
            <Minus className="w-3.5 h-3.5" />
            {summary.removedCount} words removed
          </span>
        </div>
      </div>

      <div className="editorial-prose whitespace-pre-wrap leading-relaxed">
        {diffParts.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="diff-added font-medium">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={index} className="diff-removed opacity-75">
                {part.value}
              </span>
            );
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>
    </div>
  );
};
