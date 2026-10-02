import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Trash2, X, Check } from 'lucide-react';

export interface CommentPopoverData {
  commentId: string;
  anchorText: string;
  commentText: string;
  isNew: boolean;
  position: { top: number; left: number };
}

interface CommentPopoverProps {
  data: CommentPopoverData | null;
  onSave: (commentId: string, text: string) => void;
  onDelete: (commentId: string) => void;
  onClose: () => void;
}

export const CommentPopover: React.FC<CommentPopoverProps> = ({
  data,
  onSave,
  onDelete,
  onClose,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data) {
      setText(data.commentText || '');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [data]);

  if (!data) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (text.trim()) {
        onSave(data.commentId, text.trim());
      }
    }
  };

  const handleSave = () => {
    if (text.trim()) {
      onSave(data.commentId, text.trim());
    }
  };

  return (
    <div
      className="fixed z-50 w-80 bg-white dark:bg-[#1E1C1A] border border-[#E6E0D4] dark:border-[#38332E] rounded-xl shadow-xl p-4 transition-all animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: Math.max(16, Math.min(window.innerHeight - 260, data.position.top + 28)),
        left: Math.max(16, Math.min(window.innerWidth - 340, data.position.left)),
      }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0EBE1] dark:border-[#2C2825]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Inline Review Note</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#8C827A] hover:text-[#2C2825] dark:hover:text-[#E8E6E3] p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-2 text-xs text-[#706B65] dark:text-[#9C948B] italic bg-[#F7F4EE] dark:bg-[#262320] p-2 rounded-md line-clamp-2 border border-[#EFEAE1] dark:border-[#332E2A]">
        "{data.anchorText}"
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add your critique or instruction... (Cmd+Enter to save)"
        rows={3}
        className="w-full text-sm bg-[#FAF8F5] dark:bg-[#171615] border border-[#E6E0D4] dark:border-[#38332E] rounded-lg p-2.5 text-[#2C2825] dark:text-[#E8E6E3] placeholder-[#A0988F] focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
      />

      <div className="flex items-center justify-between mt-3">
        {!data.isNew ? (
          <button
            onClick={() => onDelete(data.commentId)}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#A0988F]">Press Esc to cancel</span>
        )}

        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Save Note</span>
        </button>
      </div>
    </div>
  );
};
