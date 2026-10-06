import React, { useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Volume2,
  VolumeX,
  X,
  Keyboard,
  Headphones,
  Check,
} from 'lucide-react';
import {
  SWITCH_PROFILES,
  SwitchProfileId,
  audioEngine,
} from '../services/audioEngine.js';

interface SettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currentSwitch: SwitchProfileId;
  onSelectSwitch: (switchId: SwitchProfileId) => void;
  isAudioMuted: boolean;
  onToggleAudioMute: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
  isOpen,
  onClose,
  isDark,
  onToggleTheme,
  currentSwitch,
  onSelectSwitch,
  isAudioMuted,
  onToggleAudioMute,
  anchorRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [previewText, setPreviewText] = useState('');

  // Clear preview text when settings is closed
  useEffect(() => {
    if (!isOpen) {
      setPreviewText('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setPreviewText('');
    onClose();
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        handleClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle typing inside the preview box
  const handlePreviewKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.repeat) return;
    audioEngine.playPress(e.code, true);
  };

  const handlePreviewKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    audioEngine.playRelease(e.code, true);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 top-16 right-6 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-night-card border border-paper-border dark:border-night-border-strong rounded-2xl shadow-2xl p-5 transition-all animate-in fade-in zoom-in-95 duration-150 text-ink dark:text-night-text"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-paper-divider dark:border-night-border">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base tracking-tight font-serif text-ink dark:text-night-text-heading">
            Preferences & Settings
          </h2>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg text-ink-muted dark:text-night-text-muted hover:bg-paper-subtle dark:hover:bg-night-subtle transition-colors cursor-pointer"
          title="Close Settings (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5 pt-4">
        {/* Section 1: Appearance / Theme */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint dark:text-night-text-faint block mb-2">
            Appearance
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (isDark) onToggleTheme();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                !isDark
                  ? 'bg-paper-subtle border-accent text-accent font-semibold shadow-xs'
                  : 'border-paper-border dark:border-night-border text-ink-muted dark:text-night-text-muted hover:border-paper-divider dark:hover:border-night-border-strong'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Paper (Light)</span>
            </button>

            <button
              onClick={() => {
                if (!isDark) onToggleTheme();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                isDark
                  ? 'bg-night-subtle border-accent-pin text-accent-pin font-semibold shadow-xs'
                  : 'border-paper-border dark:border-night-border text-ink-muted dark:text-night-text-muted hover:border-paper-divider dark:hover:border-night-border-strong'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Night (Dark)</span>
            </button>
          </div>
        </div>

        {/* Section 2: Mechanical Typing Audio */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-accent dark:text-accent-pin" />
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint dark:text-night-text-faint">
                Ananta Toer Typing Audio
              </label>
            </div>
            <button
              onClick={onToggleAudioMute}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                !isAudioMuted
                  ? 'bg-accent/10 text-accent dark:text-accent-pin border-accent/20'
                  : 'bg-paper-subtle dark:bg-night-subtle text-ink-faint border-transparent'
              }`}
              title="Toggle audio enabled/muted"
            >
              {!isAudioMuted ? (
                <>
                  <Volume2 className="w-3 h-3" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3 h-3" />
                  <span>Muted</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-1.5 mb-3">
            {SWITCH_PROFILES.map((profile) => {
              const isSelected = profile.id === currentSwitch;
              return (
                <button
                  key={profile.id}
                  onClick={() => onSelectSwitch(profile.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/5 dark:bg-accent-pin/10 border-accent dark:border-accent-pin shadow-xs'
                      : 'border-paper-border dark:border-night-border hover:bg-paper-subtle/50 dark:hover:bg-night-subtle/50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-ink dark:text-night-text-heading">
                        {profile.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-subtle dark:bg-night-subtle text-ink-muted dark:text-night-text-muted font-medium">
                        {profile.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted dark:text-night-text-muted truncate mt-0.5">
                      {profile.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-accent dark:bg-accent-pin flex items-center justify-center text-white dark:text-night shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sound Preview Test Area */}
          <div className="p-2.5 rounded-xl bg-paper-subtle dark:bg-night-subtle border border-paper-border dark:border-night-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-ink-muted dark:text-night-text-muted flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5" />
                Live Sound Preview
              </span>
              {previewText && (
                <button
                  onClick={() => setPreviewText('')}
                  className="text-[10px] text-ink-faint hover:text-ink transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              onKeyDown={handlePreviewKeyDown}
              onKeyUp={handlePreviewKeyUp}
              placeholder="Click here & type to preview acoustic switch..."
              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-night-card border border-paper-divider dark:border-night-border-strong text-ink dark:text-night-text focus:outline-none focus:ring-1 focus:ring-accent dark:focus:ring-accent-pin"
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 text-[11px] text-ink-faint dark:text-night-text-faint flex items-center justify-between border-t border-paper-divider dark:border-night-border">
          <span>Audio plays in Ananta Toer Mode</span>
          <span>
            Shortcut: <kbd className="font-mono bg-paper-subtle dark:bg-night-subtle px-1 py-0.5 rounded">Alt+M</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
