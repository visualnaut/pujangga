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
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      setText(data.commentText || '');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [data]);

  // Handle outside click to close/cleanup
  useEffect(() => {
    if (!data) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay slightly to prevent the click that opened the popover from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [data, onClose]);

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
      ref={popoverRef}
      className="pujangga-popover fixed z-70 w-84 bg-paper-card dark:bg-night-popover border border-paper-border dark:border-night-border-strong rounded-2xl shadow-2xl p-4 transition-all animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: Math.max(16, Math.min(window.innerHeight - 280, data.position.top + 28)),
        left: Math.max(16, Math.min(window.innerWidth - 360, data.position.left)),
      }}
    >
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-paper-border-light dark:border-night-border">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent dark:text-accent-pin">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{data.isNew ? 'New Inline Note' : 'Inline Note'}</span>
        </div>
        <button
          onClick={onClose}
          className="text-ink-subtle hover:text-ink dark:hover:text-night-text-heading p-1 rounded-lg hover:bg-paper-hover dark:hover:bg-night-hover transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-2.5 text-xs text-ink-muted dark:text-night-text-muted italic bg-paper-muted dark:bg-night-subtle p-2.5 rounded-lg line-clamp-2 border border-paper-border-subtle dark:border-night-border-subtle">
        "{data.anchorText}"
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add your critique or instruction... (⌘ + ↵ to save)"
        rows={3}
        className="w-full text-sm bg-paper dark:bg-night-pane border border-paper-border dark:border-night-border-strong rounded-xl p-2.5 text-ink dark:text-night-text placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none shadow-xs transition-all"
      />

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-paper-border-light dark:border-night-border">
        <button
          onClick={() => onDelete(data.commentId)}
          className="flex items-center gap-1.5 text-xs text-danger hover:text-danger-hover dark:text-danger-text-dark p-1.5 rounded-lg hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors cursor-pointer font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Note</span>
        </button>

        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Save Note</span>
        </button>
      </div>
    </div>
  );
};
