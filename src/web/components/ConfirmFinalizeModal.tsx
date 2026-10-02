import React, { useEffect } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, Loader2, FileText } from 'lucide-react';

interface ConfirmFinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  roundNumber: number;
  isSubmitting: boolean;
}

export const ConfirmFinalizeModal: React.FC<ConfirmFinalizeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  roundNumber,
  isSubmitting,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-80 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-paper-card dark:bg-night-modal border border-paper-border dark:border-night-border-strong rounded-2xl p-6 shadow-2xl space-y-5 transition-all animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-ink dark:text-night-text">
                Finalize & Approve Draft
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-subtle dark:text-night-text-muted">
                <FileText className="w-3.5 h-3.5" />
                <span className="font-mono truncate max-w-[180px]">{fileName}</span>
                <span>•</span>
                <span>Round {roundNumber}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-ink-subtle hover:text-ink dark:hover:text-night-text hover:bg-paper-hover dark:hover:bg-night-hover transition-colors disabled:opacity-50 cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Explanation Box */}
        <div className="bg-paper dark:bg-night-inner border border-paper-border-subtle dark:border-night-border-subtle rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-ink-secondary dark:text-night-text-subtle leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              All current edits will be saved directly to <span className="font-semibold text-ink dark:text-night-text">{fileName}</span> as the final approved version.
            </span>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>History will be cleared:</strong> All inline comments and revision snapshots will be permanently wiped clean so future review runs start fresh.
            </span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-paper-divider dark:border-night-border-strong text-ink-body dark:text-night-text-muted hover:bg-paper-active dark:hover:bg-night-active transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Finalize & Clear History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
