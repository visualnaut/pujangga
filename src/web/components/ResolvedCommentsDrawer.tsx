import React, { useState } from 'react';
import { InlineComment } from '../../shared/types.js';
import { CheckCircle2, Circle, X, CheckSquare } from 'lucide-react';

interface ResolvedCommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  comments: InlineComment[];
  currentRound: number;
}

export const ResolvedCommentsDrawer: React.FC<ResolvedCommentsDrawerProps> = ({
  isOpen,
  onClose,
  comments,
  currentRound,
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const resolvedList = comments.filter((c) => c.status === 'resolved' || c.roundNumber < currentRound);

  const toggleCheck = (id: string) => {
    const next = new Set(checkedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCheckedIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1816] h-full shadow-2xl flex flex-col border-l border-[#E6E0D4] dark:border-[#38332E]">
        {/* Header */}
        <div className="p-5 border-b border-[#F0EBE1] dark:border-[#2C2825] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <h3 className="font-semibold text-lg text-[#2C2825] dark:text-[#E8E6E3]">
              Resolved Comments Audit
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#2C2825] dark:hover:text-[#E8E6E3] hover:bg-[#F2EDE4] dark:hover:bg-[#2A2724] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-[#8C827A] dark:text-[#9C948B]">
            Review whether the agent faithfully addressed your previous feedback items. Click a card to mark it verified.
          </p>

          {resolvedList.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A0988F]">
              No resolved comments from prior rounds yet.
            </div>
          ) : (
            resolvedList.map((c) => {
              const isChecked = checkedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggleCheck(c.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-[#F9F7F2] dark:bg-[#1E1C1A] border-[#DCD5C8] dark:border-[#3A3530] opacity-60'
                      : 'bg-white dark:bg-[#23201D] border-[#E6E0D4] dark:border-[#38332E] hover:border-amber-500/50 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                      Round {c.roundNumber} Note
                    </span>
                    <button className="text-amber-600 dark:text-amber-500">
                      {isChecked ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#B0A89F]" />
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-[#706B65] dark:text-[#A8A29D] italic mb-2 line-clamp-2">
                    "{c.anchorText}"
                  </div>

                  <div className={`text-sm ${isChecked ? 'line-through text-[#8C827A]' : 'text-[#2C2825] dark:text-[#E8E6E3]'}`}>
                    {c.commentText}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0EBE1] dark:border-[#2C2825] bg-[#FAF8F5] dark:bg-[#141312] flex items-center justify-between text-xs text-[#8C827A]">
          <span>{checkedIds.size} of {resolvedList.length} verified</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2C2825] dark:bg-[#E8E6E3] text-white dark:text-[#121110] font-medium rounded-lg text-xs hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
