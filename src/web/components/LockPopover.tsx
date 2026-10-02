import React, { useEffect, useRef } from 'react';
import { Lock, Unlock, X } from 'lucide-react';

export interface LockPopoverData {
  lockId: string;
  text: string;
  sectionHeading?: string;
  contextBefore?: string;
  contextAfter?: string;
  position: { top: number; left: number };
}

interface LockPopoverProps {
  data: LockPopoverData | null;
  onUnlock: (lockId: string) => void;
  onClose: () => void;
}

export const LockPopover: React.FC<LockPopoverProps> = ({
  data,
  onUnlock,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close
  useEffect(() => {
    if (!data) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [data, onClose]);

  // Handle Escape key
  useEffect(() => {
    if (!data) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div
      ref={popoverRef}
      className="pujangga-popover fixed z-70 w-80 bg-paper-card dark:bg-night-popover border border-paper-border dark:border-night-border-strong rounded-2xl shadow-2xl p-4 transition-all animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: Math.max(16, Math.min(window.innerHeight - 240, data.position.top + 28)),
        left: Math.max(16, Math.min(window.innerWidth - 340, data.position.left)),
      }}
    >
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-paper-border-light dark:border-night-border">
        <div className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-success dark:text-success-icon-dark">
          <Lock className="w-3.5 h-3.5" />
          <span>Locked Text Segment</span>
        </div>
        <button
          onClick={onClose}
          className="text-ink-subtle hover:text-ink dark:hover:text-night-text-heading p-1 rounded-lg hover:bg-paper-hover dark:hover:bg-night-hover transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {data.sectionHeading && (
        <div className="mb-2 text-xs font-mono px-2 py-1 rounded bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted border border-paper-border-subtle dark:border-night-border-subtle truncate">
          <span className="font-semibold text-ink-muted dark:text-night-text">Section:</span> {data.sectionHeading}
        </div>
      )}

      <div className="mb-2.5 text-sm text-ink-muted dark:text-night-text-muted italic bg-paper-muted dark:bg-night-subtle p-2.5 rounded-lg line-clamp-3 border-l-3 border-success dark:border-success-icon-dark border-t border-r border-b border-paper-border-subtle dark:border-night-border-subtle">
        "{data.text}"
      </div>

      <div className="text-sm text-ink-muted dark:text-night-text-muted mb-3 leading-relaxed">
        This segment is locked. The AI agent will preserve it verbatim across all revision rounds.
      </div>

      <div className="pt-2 border-t border-paper-border-light dark:border-night-border flex justify-end">
        <button
          type="button"
          onClick={() => onUnlock(data.lockId)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-paper-subtle hover:bg-paper-hover dark:bg-night-subtle dark:hover:bg-night-hover text-success hover:text-success-hover dark:text-success-icon-dark dark:hover:text-success-text-dark text-sm font-semibold rounded-lg transition-colors cursor-pointer border border-success/30 dark:border-success-border-dark"
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>Unlock Text</span>
        </button>
      </div>
    </div>
  );
};
