import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface FloatingAlertBannerProps {
  message: string | null;
  onClose: () => void;
  autoDismissMs?: number;
}

export const FloatingAlertBanner: React.FC<FloatingAlertBannerProps> = ({
  message,
  onClose,
  autoDismissMs = 3000,
}) => {
  const [shouldRender, setShouldRender] = useState(Boolean(message));
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(message);
  const bannerRef = useRef<HTMLDivElement>(null);
  const autoExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    if (autoExitTimerRef.current) {
      clearTimeout(autoExitTimerRef.current);
      autoExitTimerRef.current = null;
    }
    setIsAnimating(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);
      setShouldRender(true);
      setIsAnimating(false);

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (autoExitTimerRef.current) {
        clearTimeout(autoExitTimerRef.current);
      }

      // Force reflow before animating in
      const enterTimer = setTimeout(() => {
        if (bannerRef.current) void bannerRef.current.offsetHeight;
        setIsAnimating(true);
      }, 20);

      // Auto exit after 3 seconds
      autoExitTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => {
        clearTimeout(enterTimer);
        if (autoExitTimerRef.current) clearTimeout(autoExitTimerRef.current);
      };
    } else {
      if (shouldRender) {
        handleDismiss();
      }
    }
  }, [message, autoDismissMs]);

  if (!shouldRender || !currentMessage) return null;

  return (
    <div
      ref={bannerRef}
      className={`fixed top-16 sm:top-18 left-1/2 -translate-x-1/2 z-60 w-full max-w-lg px-4 pointer-events-auto transform transition-all duration-200 ease-out ${
        isAnimating
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-3 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-paper-card dark:bg-night-modal border-2 border-accent dark:border-accent-pin rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 text-ink dark:text-night-text">
        <div className="w-9 h-9 rounded-xl bg-accent-subtle dark:bg-accent-subtle-dark text-accent dark:text-accent-pin flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="font-serif font-bold text-sm text-ink dark:text-night-text-heading mb-0.5">
            Unable to Request Revision
          </h4>
          <p className="text-sm text-ink-body dark:text-night-text-subtle leading-relaxed">
            {currentMessage}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-ink-subtle hover:text-ink dark:hover:text-night-text hover:bg-paper-hover dark:hover:bg-night-hover transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
