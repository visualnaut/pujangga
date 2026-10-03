import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface SnackbarData {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'danger' | 'error' | 'lock';
}

interface SnackbarProps {
  data: SnackbarData | null;
  onClose: () => void;
  autoDismissMs?: number;
}

interface SnackbarTheme {
  card: string;
  iconBox: string;
  title: string;
  message: string;
  btn: string;
}

const THEMES: Record<string, SnackbarTheme> = {
  info: {
    card: 'bg-blue-50/95 dark:bg-[#0B1A2C]/95 border-blue-200 dark:border-blue-900/60 shadow-blue-500/10',
    iconBox: 'bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
    title: 'text-blue-950 dark:text-blue-100',
    message: 'text-blue-800/90 dark:text-blue-300',
    btn: 'text-blue-500 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100/70 dark:hover:bg-blue-900/40',
  },
  warning: {
    card: 'bg-[#FFF9F5]/95 dark:bg-[#28160B]/95 border-accent-border dark:border-accent-border-dark shadow-accent/10',
    iconBox: 'bg-accent-subtle dark:bg-accent-subtle-dark text-accent dark:text-accent-pin border-accent-border dark:border-accent-border-dark',
    title: 'text-[#6B2000] dark:text-[#FFD2BD]',
    message: 'text-[#942C00] dark:text-[#FFB594]',
    btn: 'text-accent dark:text-accent-pin hover:text-accent-active dark:hover:text-accent-bright hover:bg-accent-subtle dark:hover:bg-accent-subtle-dark',
  },
  danger: {
    card: 'bg-red-50/95 dark:bg-[#2D0F13]/95 border-red-200 dark:border-red-900/60 shadow-red-500/10',
    iconBox: 'bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60',
    title: 'text-red-950 dark:text-red-100',
    message: 'text-red-800/90 dark:text-red-300',
    btn: 'text-red-500 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-100/70 dark:hover:bg-red-900/40',
  },
  lock: {
    card: 'bg-emerald-50/95 dark:bg-[#07241A]/95 border-emerald-200 dark:border-emerald-900/60 shadow-emerald-500/10',
    iconBox: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
    title: 'text-emerald-950 dark:text-emerald-100',
    message: 'text-emerald-800/90 dark:text-emerald-300',
    btn: 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40',
  },
};

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

  const normalizedType =
    currentData.type === 'error' ? 'danger' : currentData.type || 'info';
  const theme = THEMES[normalizedType] || THEMES.info;

  const defaultTitle =
    normalizedType === 'warning'
      ? 'Unable to Request Revision'
      : normalizedType === 'danger'
      ? 'Action Blocked'
      : normalizedType === 'lock'
      ? 'Locked Text Protected'
      : 'Noted Text Protected';
  const title = currentData.title || defaultTitle;

  return (
    <div
      className={`fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-70 w-full max-w-md px-4 pointer-events-auto transform transition-all duration-200 ease-out ${
        isAnimating
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div
        className={`border rounded-2xl p-4 shadow-xl dark:shadow-2xl flex items-center gap-3 backdrop-blur-md transition-colors ${theme.card}`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${theme.iconBox}`}
        >
          {normalizedType === 'warning' ? (
            <AlertCircle className="w-5 h-5" />
          ) : normalizedType === 'danger' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : normalizedType === 'lock' ? (
            <Lock className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <p className={`font-semibold text-sm leading-snug ${theme.title}`}>
            {title}
          </p>
          <p className={`text-sm leading-tight mt-0.5 ${theme.message}`}>
            {currentData.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${theme.btn}`}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
