import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, Info, X } from 'lucide-react';

export interface SnackbarData {
  title?: string;
  message: string;
  type?: 'lock' | 'warning' | 'info' | 'error';
}

interface SnackbarProps {
  data: SnackbarData | null;
  onClose: () => void;
  autoDismissMs?: number;
}

export const Snackbar: React.FC<SnackbarProps> = ({
  data,
  onClose,
  autoDismissMs = 3500,
}) => {
  const [shouldRender, setShouldRender] = useState(Boolean(data));
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentData, setCurrentData] = useState<SnackbarData | null>(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsAnimating(false);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (data) {
      setCurrentData(data);
      setShouldRender(true);
      setIsAnimating(false);

      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const enterTimer = setTimeout(() => {
        setIsAnimating(true);
      }, 20);

      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => {
        clearTimeout(enterTimer);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else {
      if (shouldRender) {
        handleDismiss();
      }
    }
  }, [data, autoDismissMs]);

  if (!shouldRender || !currentData) return null;

  const type = currentData.type || 'lock';
  const defaultTitle =
    type === 'warning'
      ? 'Unable to Request Revision'
      : type === 'info'
      ? 'Noted Text Protected'
      : 'Locked Text Protected';
  const title = currentData.title || defaultTitle;

  return (
    <div
      className={`fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-70 w-full max-w-md px-4 pointer-events-auto transform transition-all duration-200 ease-out ${
        isAnimating
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-ink dark:bg-night-card text-white dark:text-night-text border border-black/20 dark:border-night-border-strong rounded-2xl p-4 shadow-2xl flex items-center gap-3 backdrop-blur-md">
        {type === 'warning' ? (
          <div className="w-9 h-9 rounded-xl bg-accent-subtle dark:bg-accent-subtle-dark text-accent dark:text-accent-pin flex items-center justify-center shrink-0 border border-accent-border dark:border-accent-border-dark">
            <AlertCircle className="w-5 h-5" />
          </div>
        ) : type === 'info' ? (
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <Info className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-success/20 dark:bg-success-subtle-dark text-success-text-dark dark:text-success-icon-dark flex items-center justify-center shrink-0 border border-success/30 dark:border-success-border-dark">
            <Lock className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0 pr-1">
          <p className="font-semibold text-sm text-white dark:text-night-text-heading">
            {title}
          </p>
          <p className="text-sm text-gray-300 dark:text-night-text-muted leading-tight mt-0.5">
            {currentData.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-gray-400 hover:text-white dark:hover:text-night-text hover:bg-white/10 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
