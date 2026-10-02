import React, { useState, useEffect, useRef } from 'react';
import { LockedText } from '../../shared/types.js';
import { Lock, Unlock, X } from 'lucide-react';

interface LockedTextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lockedTexts: LockedText[];
  onUnlock: (lockId: string) => void;
}

export const LockedTextDrawer: React.FC<LockedTextDrawerProps> = ({
  isOpen,
  onClose,
  lockedTexts,
  onUnlock,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(false);
      const timer = setTimeout(() => {
        if (drawerRef.current) {
          void drawerRef.current.offsetHeight;
        }
        setIsAnimating(true);
      }, 25);
      return () => clearTimeout(timer);
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
    if (!shouldRender) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  // Sort locked texts by round and timestamp descending
  const sortedLocked = [...lockedTexts].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div
      className={`fixed inset-0 z-70 overflow-hidden flex justify-end ${
        isAnimating ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Clickable Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-250 ease-out cursor-pointer ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`relative z-10 w-full max-w-xl bg-paper-card dark:bg-night-card h-full shadow-2xl flex flex-col border-l border-paper-border dark:border-night-border-strong transform transition-transform duration-250 ease-out ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-paper-border-light dark:border-night-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-success-subtle dark:bg-success-subtle-dark text-success-icon dark:text-success-icon-dark flex items-center justify-center border border-success-border dark:border-success-border-dark">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-ink dark:text-night-text">
                  Locked Text Segments
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-success-subtle dark:bg-success-subtle-dark text-success-text dark:text-success-text-dark border border-success-border dark:border-success-border-dark">
                  {lockedTexts.length}
                </span>
              </div>
              <p className="text-sm text-ink-subtle dark:text-night-text-muted">
                Protected text segments that remain verbatim across revision rounds.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-ink-subtle hover:text-ink dark:hover:text-night-text hover:bg-paper-hover dark:hover:bg-night-hover transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sortedLocked.length === 0 ? (
            <div className="py-16 text-center">
              <Lock className="w-10 h-10 mx-auto text-ink-faint mb-3 opacity-40" />
              <p className="text-sm font-medium text-ink-muted dark:text-night-text-muted">
                No locked text segments yet.
              </p>
              <p className="text-sm text-ink-faint mt-1">
                Highlight any text in the editor and click "Lock Text" to prevent the agent from changing it.
              </p>
            </div>
          ) : (
            sortedLocked.map((item) => (
              <div
                key={item.id}
                className="bg-paper dark:bg-night-pane border border-paper-border dark:border-night-border-strong rounded-xl p-4 shadow-2xs space-y-3"
              >
                {/* Header row with Round badge and Unlock button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted border border-paper-border dark:border-night-border">
                    Locked in Round {item.roundNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnlock(item.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-paper-subtle hover:bg-paper-hover dark:bg-night-subtle dark:hover:bg-night-hover text-success hover:text-success-hover dark:text-success-icon-dark dark:hover:text-success-text-dark border border-success/30 dark:border-success-border-dark transition-colors cursor-pointer"
                    title="Unlock this segment"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock</span>
                  </button>
                </div>

                {/* Verbatim quote */}
                <blockquote className="text-sm font-serif italic text-ink dark:text-night-text bg-paper-subtle dark:bg-night-subtle p-3 rounded-lg border-l-3 border-success dark:border-success-icon-dark leading-relaxed">
                  "{item.text}"
                </blockquote>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
