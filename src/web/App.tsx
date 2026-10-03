import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { closeHistory } from '@tiptap/pm/history';
import { CommentMark } from './extensions/CommentMark.js';
import { LockMark } from './extensions/LockMark.js';
import { Navbar } from './components/Navbar.js';
import { ActionBar } from './components/ActionBar.js';
import { DesktopSidebar } from './components/DesktopSidebar.js';
import { DiffViewer } from './components/DiffViewer.js';
import { CommentHistoryDrawer } from './components/CommentHistoryDrawer.js';
import { LockedTextDrawer } from './components/LockedTextDrawer.js';
import { CommentPopover, CommentPopoverData } from './components/CommentPopover.js';
import { LockPopover, LockPopoverData } from './components/LockPopover.js';
import { ConfirmFinalizeModal } from './components/ConfirmFinalizeModal.js';
import { EditorialBubbleMenu } from './components/EditorialBubbleMenu.js';
import { Snackbar, SnackbarData } from './components/Snackbar.js';
import { SessionDetails, InlineComment, LockedText, ReviewStatus } from '../shared/types.js';
import { CheckCircle2, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [comparisonRound, setComparisonRound] = useState<number>(1);
  const [isCommentHistoryOpen, setIsCommentHistoryOpen] = useState(false);
  const [isLockedDrawerOpen, setIsLockedDrawerOpen] = useState(false);
  const [isConfirmFinalizeOpen, setIsConfirmFinalizeOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [overallComment, setOverallComment] = useState('');
  const [snackbarData, setSnackbarData] = useState<SnackbarData | null>(null);
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem('pujangga_theme') === 'dark' ||
      (!('pujangga_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comments state
  const [localComments, setLocalComments] = useState<InlineComment[]>([]);
  const [popoverData, setPopoverData] = useState<CommentPopoverData | null>(null);

  // Locked texts state
  const [localLockedTexts, setLocalLockedTexts] = useState<LockedText[]>([]);
  const [lockPopoverData, setLockPopoverData] = useState<LockPopoverData | null>(null);

  // Extract sessionId from URL (/review/:id or ?sessionId=xyz)
  const sessionId = React.useMemo(() => {
    const pathParts = window.location.pathname.split('/');
    const reviewIdx = pathParts.indexOf('review');
    if (reviewIdx !== -1 && pathParts[reviewIdx + 1]) {
      return pathParts[reviewIdx + 1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('sessionId') || '';
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pujangga_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pujangga_theme', 'light');
    }
  }, [isDark]);

  // Keyboard shortcut for toggling Hemingway Mode (Cmd+Shift+F) or Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      } else if (e.key === 'Escape' && isZenMode) {
        if (!isCommentHistoryOpen && !isLockedDrawerOpen && !isConfirmFinalizeOpen && !popoverData && !lockPopoverData) {
          setIsZenMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, isCommentHistoryOpen, isLockedDrawerOpen, isConfirmFinalizeOpen, popoverData, lockPopoverData]);

  // Listen for locked text delete / modification violation attempts
  useEffect(() => {
    const handleLockViolation = (e: any) => {
      const msg =
        e.detail?.message ||
        'Cannot delete content containing locked text. Unlock the text segment first.';
      setSnackbarData({
        title: 'Locked Text Protected',
        message: msg,
        type: 'danger',
      });
    };
    window.addEventListener('pujangga:locked-text-delete-attempt', handleLockViolation);
    return () => window.removeEventListener('pujangga:locked-text-delete-attempt', handleLockViolation);
  }, []);

  // Listen for noted text delete / modification violation attempts
  useEffect(() => {
    const handleNotedViolation = (e: any) => {
      const msg =
        e.detail?.message ||
        'Cannot delete content containing active notes. Remove or resolve the note first.';
      setSnackbarData({
        title: 'Noted Text Protected',
        message: msg,
        type: 'info',
      });
    };
    window.addEventListener('pujangga:noted-text-delete-attempt', handleNotedViolation);
    return () => window.removeEventListener('pujangga:noted-text-delete-attempt', handleNotedViolation);
  }, []);

  // Fetch session details
  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error(`Failed to load session: ${res.statusText}`);
      }
      const data: SessionDetails = await res.json();
      setDetails(data);
      setLocalComments(data.comments || []);
      setLocalLockedTexts(data.lockedTexts || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading session');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Setup WebSocket for live updates across rounds
  useEffect(() => {
    if (!sessionId) return;

    fetchSession();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${sessionId}`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (
            msg.type === 'SESSION_INIT' ||
            msg.type === 'ROUND_UPDATED' ||
            msg.type === 'REVISING_WAIT' ||
            msg.type === 'SESSION_SATISFIED' ||
            msg.type === 'LOCKED_TEXTS_UPDATED'
          ) {
            const updatedDetails: SessionDetails = msg.payload;
            setDetails(updatedDetails);
            setLocalComments(updatedDetails.comments || []);
            setLocalLockedTexts(updatedDetails.lockedTexts || []);

            // If a new round was pushed by agent, update editor text!
            if (msg.type === 'ROUND_UPDATED' && editor) {
              const newContent = updatedDetails.currentRevision?.contentMarkdown || '';
              editor.chain().setMeta('allowLockEdit', true).setMeta('allowCommentEdit', true).setContent(newContent).run();
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [sessionId, fetchSession]);

  // Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      CommentMark,
      LockMark,
      Placeholder.configure({
        placeholder: 'Writing draft appears here...',
      }),
    ],
    content: details?.currentRevision?.contentMarkdown || '',
    editorProps: {
      attributes: {
        class: 'editorial-prose min-h-[500px] focus:outline-none',
      },
    },
  });

  // Helper to re-apply lock marks across the document for known locked texts with contextual anchoring
  const applyLocksToEditor = useCallback(
    (currentEditor: any, lockedList: LockedText[]) => {
      if (!currentEditor || !lockedList || lockedList.length === 0) return;
      const { state, view } = currentEditor;
      if (!state || !view) return;

      const lockMarkType = state.schema.marks.lock;
      if (!lockMarkType) return;

      const { tr } = state;
      tr.setMeta('allowLockEdit', true);
      tr.setMeta('addToHistory', false);
      closeHistory(tr);
      let changed = false;

      for (const lock of lockedList) {
        const targetText = lock.text.trim();
        if (!targetText) continue;

        let alreadyMarked = false;
        tr.doc.descendants((node: any) => {
          if (node.isText && node.marks) {
            if (node.marks.some((m: any) => m.type === lockMarkType && m.attrs.lockId === lock.id)) {
              alreadyMarked = true;
            }
          }
        });
        if (alreadyMarked) continue;

        // Collect all candidates across the document
        interface Candidate {
          from: number;
          to: number;
          score: number;
        }
        const candidates: Candidate[] = [];

        let currentSection = '';
        tr.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'heading') {
            const level = node.attrs.level || 1;
            const hashes = '#'.repeat(level);
            currentSection = `${hashes} ${node.textContent.trim()}`;
            return;
          }

          if (node.isBlock && node.textContent.includes(targetText)) {
            const blockText = node.textContent;
            let searchIndex = 0;

            while (searchIndex < blockText.length) {
              const matchIdx = blockText.indexOf(targetText, searchIndex);
              if (matchIdx === -1) break;

              let currentOffset = 0;
              let fromPos: number | null = null;
              let toPos: number | null = null;

              node.descendants((child: any, childPos: number) => {
                if (!child.isText || !child.text) return;
                const childStart = currentOffset;
                const childEnd = currentOffset + child.text.length;

                if (fromPos === null && matchIdx >= childStart && matchIdx < childEnd) {
                  fromPos = pos + 1 + childPos + (matchIdx - childStart);
                }
                if (
                  toPos === null &&
                  matchIdx + targetText.length <= childEnd &&
                  matchIdx + targetText.length > childStart
                ) {
                  toPos = pos + 1 + childPos + (matchIdx + targetText.length - childStart);
                }
                currentOffset += child.text.length;
              });

              if (fromPos !== null && toPos !== null) {
                let score = 1;
                if (lock.sectionHeading && currentSection) {
                  if (currentSection === lock.sectionHeading) {
                    score += 20;
                  } else if (currentSection.toLowerCase().includes(lock.sectionHeading.toLowerCase())) {
                    score += 10;
                  }
                }
                if (lock.contextBefore) {
                  const preceding = blockText.slice(Math.max(0, matchIdx - 60), matchIdx);
                  if (preceding.includes(lock.contextBefore) || lock.contextBefore.includes(preceding)) {
                    score += 15;
                  }
                }
                if (lock.contextAfter) {
                  const succeeding = blockText.slice(
                    matchIdx + targetText.length,
                    matchIdx + targetText.length + 60
                  );
                  if (succeeding.includes(lock.contextAfter) || lock.contextAfter.includes(succeeding)) {
                    score += 15;
                  }
                }

                candidates.push({ from: fromPos, to: toPos, score });
              }

              searchIndex = matchIdx + targetText.length;
            }
          }
        });

        // Apply lock mark to candidate with highest contextual score
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          tr.addMark(best.from, best.to, lockMarkType.create({ lockId: lock.id }));
          changed = true;
        }
      }

      if (changed) {
        view.dispatch(tr);
      }
    },
    []
  );

  // Sync content into editor on first load or when revision id changes
  const prevRevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (editor && details?.currentRevision) {
      if (prevRevIdRef.current !== details.currentRevision.id) {
        prevRevIdRef.current = details.currentRevision.id;
        editor.chain().setMeta('allowLockEdit', true).setMeta('allowCommentEdit', true).setContent(details.currentRevision.contentMarkdown).run();
        if (localLockedTexts.length > 0) {
          setTimeout(() => {
            applyLocksToEditor(editor, localLockedTexts);
          }, 20);
        }
      }
    }
  }, [editor, details?.currentRevision, localLockedTexts, applyLocksToEditor]);

  // Keep locks applied when localLockedTexts changes
  useEffect(() => {
    if (editor && localLockedTexts.length > 0) {
      applyLocksToEditor(editor, localLockedTexts);
    }
  }, [editor, localLockedTexts, applyLocksToEditor]);

  // Handle clicking on comment or lock highlights in the editor (both in standard and diff views)
  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Check if user clicked on a locked text highlight
      const lockHighlight = target.closest('[data-lock-id]') as HTMLElement;
      if (lockHighlight) {
        const lockId = lockHighlight.getAttribute('data-lock-id');
        if (lockId) {
          const rect = lockHighlight.getBoundingClientRect();
          const lock = localLockedTexts.find((l) => l.id === lockId);
          setLockPopoverData({
            lockId,
            text: lock?.text || lockHighlight.innerText.replace(/🔒/g, '').trim(),
            sectionHeading: lock?.sectionHeading,
            contextBefore: lock?.contextBefore,
            contextAfter: lock?.contextAfter,
            position: { top: rect.top, left: rect.left },
          });
          return;
        }
      }

      // 2. Check if user clicked on a comment highlight
      const highlight = target.closest('[data-comment-id]') as HTMLElement;
      if (highlight) {
        const commentId = highlight.getAttribute('data-comment-id');
        if (commentId) {
          const rect = highlight.getBoundingClientRect();
          const comment = localComments.find((c) => c.id === commentId);
          setPopoverData({
            commentId,
            anchorText: comment?.anchorText || highlight.innerText,
            commentText: comment?.commentText || '',
            isNew: !comment,
            position: { top: rect.top, left: rect.left },
          });
        }
      }
    };

    document.addEventListener('click', handleEditorClick);
    return () => document.removeEventListener('click', handleEditorClick);
  }, [localComments, localLockedTexts]);

  // Handle Link from selection tooltip or keyboard shortcut
  // Handle Link from keyboard shortcut (Cmd+K)
  const handleLinkPrompt = () => {
    if (!editor) return;
    const isLinkActive = editor.isActive('link');
    const previousUrl = isLinkActive ? editor.getAttributes('link').href || '' : '';
    const url = window.prompt(
      isLinkActive ? 'Edit URL (leave blank to remove link):' : 'Enter link URL (e.g. https://example.com):',
      previousUrl || 'https://'
    );
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to && !isLinkActive) {
      editor.chain().focus().insertContent(`<a href="${url.trim()}">${url.trim()}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    }
  };

  // Keyboard shortcut for Insert/Edit Link (Cmd+K)
  useEffect(() => {
    const handleLinkShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (editor && editor.isFocused) {
          e.preventDefault();
          handleLinkPrompt();
        }
      }
    };
    window.addEventListener('keydown', handleLinkShortcut);
    return () => window.removeEventListener('keydown', handleLinkShortcut);
  }, [editor]);

  // Add Comment from selection
  const handleAddCommentFromSelection = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    // Disallow adding notes to locked text
    const lockMarkType = editor.state.schema.marks.lock;
    if (lockMarkType && editor.state.doc.rangeHasMark(from, to, lockMarkType)) {
      return;
    }

    const anchorText = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!anchorText) return;

    const commentId = crypto.randomUUID();

    let position = { top: 0, left: 0 };
    if (editor.view) {
      try {
        const coords = editor.view.coordsAtPos(to);
        position = { top: coords.top, left: coords.left };
      } catch {
        // fallback
      }
    }

    // Apply comment mark to the selected text
    editor.chain().focus().setComment(commentId).run();

    setPopoverData({
      commentId,
      anchorText,
      commentText: '',
      isNew: true,
      position,
    });
  };

  // Lock Text from selection with Contextual Anchoring
  const handleLockTextFromSelection = async () => {
    if (!editor || !details) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    // Disallow re-locking if already locked
    const lockMarkType = editor.state.schema.marks.lock;
    if (lockMarkType && editor.state.doc.rangeHasMark(from, to, lockMarkType)) {
      return;
    }

    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!text) return;

    const lockId = crypto.randomUUID();

    // Contextual Anchoring: Find nearest preceding markdown heading in the document
    let sectionHeading: string | undefined = undefined;
    editor.state.doc.nodesBetween(0, from, (node) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level || 1;
        const hashes = '#'.repeat(level);
        sectionHeading = `${hashes} ${node.textContent.trim()}`;
      }
    });

    // Contextual Anchoring: Extract contextBefore and contextAfter in the current block
    const $from = editor.state.doc.resolve(from);
    const blockStart = $from.start();
    const beforeFull = editor.state.doc.textBetween(blockStart, from, ' ');
    const contextBefore = beforeFull.slice(-60).trim() || undefined;

    const blockEnd = $from.end();
    const afterFull = editor.state.doc.textBetween(to, blockEnd, ' ');
    const contextAfter = afterFull.slice(0, 60).trim() || undefined;

    // Apply lock mark in Tiptap
    editor.chain().focus().setLock(lockId).run();

    const newLock: LockedText = {
      id: lockId,
      sessionId: details.session.id,
      text,
      roundNumber: details.currentRevision?.roundNumber || 1,
      createdAt: Date.now(),
      sectionHeading,
      contextBefore,
      contextAfter,
    };

    setLocalLockedTexts((prev) => [...prev, newLock]);

    try {
      await fetch(`/api/sessions/${details.session.id}/locked-texts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lockId,
          text,
          sectionHeading,
          contextBefore,
          contextAfter,
        }),
      });
    } catch (err) {
      console.error('Failed to persist locked text:', err);
    }
  };

  // Unlock Text
  const handleUnlockText = async (lockId: string) => {
    if (!details) return;

    if (editor) {
      editor.commands.removeLock(lockId);
    }

    setLocalLockedTexts((prev) => prev.filter((l) => l.id !== lockId));
    setLockPopoverData(null);

    try {
      await fetch(`/api/sessions/${details.session.id}/locked-texts/${lockId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete locked text:', err);
    }
  };

  // Save comment in local state
  const handleSaveComment = (commentId: string, text: string) => {
    if (!details?.currentRevision) return;

    if (snackbarData?.type === 'warning') {
      setSnackbarData(null);
    }
    setLocalComments((prev) => {
      const existing = prev.find((c) => c.id === commentId);
      if (existing) {
        return prev.map((c) => (c.id === commentId ? { ...c, commentText: text } : c));
      }
      const newComment: InlineComment = {
        id: commentId,
        revisionId: details.currentRevision.id,
        sessionId: details.session.id,
        anchorText: popoverData?.anchorText || '',
        commentText: text,
        status: 'open',
        roundNumber: details.currentRevision.roundNumber,
        createdAt: Date.now(),
      };
      return [...prev, newComment];
    });

    setPopoverData(null);
  };

  // Update directive and clear revision warning if directive is typed
  const handleOverallCommentChange = (val: string) => {
    setOverallComment(val);
    if (snackbarData?.type === 'warning' && val.trim().length > 0) {
      setSnackbarData(null);
    }
  };

  // Delete comment and strip mark completely
  const handleDeleteComment = (commentId: string) => {
    setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
    if (editor) {
      editor.commands.removeComment(commentId);
    }
    setPopoverData(null);
  };

  // Close comment popover (cleans up unsaved mark if new)
  const handleClosePopover = () => {
    if (popoverData?.isNew && editor) {
      editor.commands.removeComment(popoverData.commentId);
    }
    setPopoverData(null);
  };

  // Toggle Diff Mode (always defaults to comparing previous round with current round)
  const handleToggleDiff = () => {
    setShowDiff((prev) => {
      const next = !prev;
      if (next && details) {
        const current = details.currentRevision?.roundNumber || 1;
        const prevRound = current > 1 ? current - 1 : 1;
        setComparisonRound(prevRound);
      }
      return next;
    });
  };

  // Validate revision request: requires at least 1 new note or 1 directive
  const handleRequestRevision = (): boolean => {
    if (!editor || !details?.currentRevision) return false;

    const currentRound = details.currentRevision.roundNumber;
    const currentRoundNotes = localComments.filter(
      (c) => c.roundNumber === currentRound && c.status === 'open' && c.commentText.trim().length > 0
    );
    const hasNotes = currentRoundNotes.length > 0;
    const hasDirective = overallComment.trim().length > 0;

    if (!hasNotes && !hasDirective) {
      setSnackbarData({
        title: 'Unable to Request Revision',
        message:
          'Please add at least one note on the draft or write guidance in the directive box.',
        type: 'warning',
      });
      return false;
    }

    if (snackbarData?.type === 'warning') {
      setSnackbarData(null);
    }
    submitReview('NEEDS_REVISION');
    return true;
  };

  // Submit review round
  const submitReview = async (status: ReviewStatus) => {
    if (!editor || !details) return;

    if (status === 'NEEDS_REVISION') {
      const currentRound = details.currentRevision?.roundNumber || 1;
      const currentRoundNotes = localComments.filter(
        (c) => c.roundNumber === currentRound && c.status === 'open' && c.commentText.trim().length > 0
      );
      const hasNotes = currentRoundNotes.length > 0;
      const hasDirective = overallComment.trim().length > 0;

      if (!hasNotes && !hasDirective) {
        setSnackbarData({
          title: 'Unable to Request Revision',
          message:
            'Please add at least one note on the draft or write guidance in the directive box.',
          type: 'warning',
        });
        return false;
      }
    }

    if (snackbarData?.type === 'warning') {
      setSnackbarData(null);
    }
    setIsSubmitting(true);
    try {
      const markdown = (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();

      const openComments = localComments
        .filter((c) => c.status === 'open' && c.roundNumber === details.currentRevision.roundNumber)
        .map((c) => ({
          id: c.id,
          anchorText: c.anchorText,
          commentText: c.commentText,
          contextBefore: c.contextBefore,
        }));

      const res = await fetch(`/api/sessions/${details.session.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEditedMarkdown: markdown,
          overallComment,
          status,
          inlineComments: openComments,
          lockedTexts: localLockedTexts.map((l) => ({
            id: l.id,
            text: l.text,
            sectionHeading: l.sectionHeading,
            contextBefore: l.contextBefore,
            contextAfter: l.contextAfter,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit review');
      }

      setOverallComment('');
      if (status === 'SATISFIED') {
        setLocalComments([]);
        setLocalLockedTexts([]);
        setShowDiff(false);
      }
      await fetchSession();
      return true;
    } catch (err: any) {
      setSnackbarData({
        title: 'Submission Error',
        message: err.message || 'Failed to submit review',
        type: 'danger',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request approval: open confirmation modal first
  const handleRequestApprove = () => {
    setIsConfirmFinalizeOpen(true);
  };

  // Confirm approval: submit SATISFIED and close modal
  const handleConfirmApprove = async () => {
    await submitReview('SATISFIED');
    setIsConfirmFinalizeOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper dark:bg-night">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent dark:text-accent-pin" />
          <p className="text-sm font-serif text-ink-muted dark:text-night-text-muted">Opening Pujangga review canvas...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-paper dark:bg-night">
        <div className="max-w-md w-full bg-paper-card dark:bg-night-popover border border-paper-border dark:border-night-border-strong rounded-2xl p-6 text-center shadow-lg">
          <img
            src="/pujangga.png"
            alt="Pujangga logo"
            className="w-14 h-14 rounded-2xl object-contain mx-auto mb-4 shadow-sm"
          />
          <h2 className="text-lg font-bold font-serif mb-2 text-ink dark:text-night-text-heading">No Active Review Session</h2>
          <p className="text-sm text-ink-muted dark:text-night-text-muted mb-6">
            {error || 'Start a review by executing `pujangga <filepath>` from your terminal or agent harness.'}
          </p>
          <div className="text-sm bg-paper dark:bg-night-surface p-3 rounded-lg font-mono text-ink-subtle border border-paper-border-subtle dark:border-night-border">
            $ npx -y pujangga draft.md
          </div>
        </div>
      </div>
    );
  }

  const currentRound = details.currentRevision?.roundNumber || 1;
  const hasMultipleRounds = details.revisions.length >= 2;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink dark:bg-night dark:text-night-text transition-colors pb-24 lg:pb-12">
      {/* 50% Black Overlay in Hemingway Mode */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-[600ms] ease-in-out z-20 pointer-events-none ${
          isZenMode ? 'opacity-50 delay-300' : 'opacity-0 delay-0'
        }`}
        aria-hidden="true"
      />

      {/* Top Navbar */}
      <Navbar
        title={details.session.title}
        filePath={details.session.filePath}
        roundNumber={currentRound}
        status={details.session.status}
        showDiff={showDiff}
        onToggleDiff={handleToggleDiff}
        hasPreviousRevision={hasMultipleRounds}
        totalCommentsCount={localComments.length}
        onOpenCommentHistory={() => setIsCommentHistoryOpen(true)}
        totalLockedCount={localLockedTexts.length}
        onOpenLockedTexts={() => setIsLockedDrawerOpen(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((v) => !v)}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode((v) => !v)}
      />

      {/* Floating Snackbar for Locked Text Protection & Revision Warnings */}
      <Snackbar
        data={snackbarData}
        onClose={() => setSnackbarData(null)}
        autoDismissMs={3500}
      />

      {/* Main Container: Flex Row on Desktop (Canvas + Right Sidebar), Centered in Hemingway Mode */}
      <div
        className={`mx-auto w-full px-4 sm:px-6 py-8 flex flex-col lg:flex-row items-start transition-all duration-300 ease-in-out ${
          isZenMode ? 'max-w-4xl justify-center gap-0 relative z-30' : 'max-w-7xl gap-6'
        }`}
      >
        {/* Left/Center Editorial Reading & Writing Canvas */}
        <main
          className={`flex-1 min-w-0 w-full relative transition-all duration-300 ease-in-out ${
            isZenMode ? 'max-w-4xl mx-auto' : ''
          }`}
        >
          {/* Waiting State Notice on Mobile/Tablet */}
          {details.session.status === 'revising' && (
            <div className="lg:hidden mb-6 p-4 rounded-xl bg-accent-subtle dark:bg-accent-subtle-dark border border-accent-border dark:border-accent-border-dark flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-accent dark:text-accent-pin animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-accent-text dark:text-accent-text-dark">
                  Agent is revising Round {currentRound}...
                </p>
                <p className="text-sm text-accent dark:text-accent-pin">
                  Keep this tab open. It will automatically update once the agent completes the revision.
                </p>
              </div>
            </div>
          )}

          {/* Satisfied Celebration Notice on Mobile/Tablet */}
          {details.session.status === 'satisfied' && (
            <div className="lg:hidden mb-6 p-5 rounded-2xl bg-success-subtle dark:bg-success-subtle-dark border border-success-border dark:border-success-border-dark flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-success-subtle dark:bg-success-subtle-dark text-success-icon dark:text-success-icon-dark flex items-center justify-center shrink-0 border border-success-border dark:border-success-border-dark">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-success-text dark:text-success-text-dark font-serif">
                  Review Concluded & Approved!
                </h3>
                <p className="text-sm text-success-icon dark:text-success-icon-dark">
                  The target file on disk contains your approved text.
                </p>
              </div>
            </div>
          )}

          {/* Editorial Bubble Menu for Formatting, Notes & Locking Text */}
          <EditorialBubbleMenu
            editor={editor}
            disabled={details.session.status !== 'active'}
            onAddComment={handleAddCommentFromSelection}
            onLockText={handleLockTextFromSelection}
          />

          {/* Side-by-Side Floating Diff View or In-Place Editor */}
          {showDiff && details ? (
            <DiffViewer
              revisions={details.revisions}
              currentRound={currentRound}
              comparisonRound={comparisonRound}
              onChangeComparisonRound={setComparisonRound}
              onClose={() => setShowDiff(false)}
              editor={editor}
              status={details.session.status}
              overallComment={overallComment}
              onOverallCommentChange={handleOverallCommentChange}
              onSubmitRevision={handleRequestRevision}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="paper-surface relative overflow-hidden bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border-strong shadow-xl transition-colors p-6 sm:p-10 md:p-14">
              <div className="relative z-10">
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar on Desktop Viewport with Hemingway Mode Transition */}
        <div
          className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
            isZenMode
              ? 'w-0 opacity-0 pointer-events-none -mr-8 hidden lg:block'
              : 'hidden lg:block w-84 opacity-100'
          }`}
        >
          <DesktopSidebar
            status={details.session.status}
            roundNumber={currentRound}
            overallComment={overallComment}
            onOverallCommentChange={handleOverallCommentChange}
            onSubmitRevision={handleRequestRevision}
            onApprove={handleRequestApprove}
            isSubmitting={isSubmitting}
            totalCommentsCount={localComments.length}
            totalLockedCount={localLockedTexts.length}
            onOpenCommentHistory={() => setIsCommentHistoryOpen(true)}
            onOpenLockedTexts={() => setIsLockedDrawerOpen(true)}
            editor={editor}
          />
        </div>
      </div>

      {/* Floating Comment Popover */}
      <CommentPopover
        data={popoverData}
        onSave={handleSaveComment}
        onDelete={handleDeleteComment}
        onClose={handleClosePopover}
      />

      {/* Floating Lock Popover */}
      <LockPopover
        data={lockPopoverData}
        onUnlock={handleUnlockText}
        onClose={() => setLockPopoverData(null)}
      />

      {/* Comment History Drawer */}
      <CommentHistoryDrawer
        isOpen={isCommentHistoryOpen}
        onClose={() => setIsCommentHistoryOpen(false)}
        comments={localComments}
        revisions={details.revisions}
        currentRound={currentRound}
      />

      {/* Locked Text Drawer */}
      <LockedTextDrawer
        isOpen={isLockedDrawerOpen}
        onClose={() => setIsLockedDrawerOpen(false)}
        lockedTexts={localLockedTexts}
        onUnlock={handleUnlockText}
      />

      {/* Confirm Finalize & Clear History Modal */}
      <ConfirmFinalizeModal
        isOpen={isConfirmFinalizeOpen}
        onClose={() => setIsConfirmFinalizeOpen(false)}
        onConfirm={handleConfirmApprove}
        fileName={details.session.title}
        roundNumber={currentRound}
        isSubmitting={isSubmitting}
      />

      {/* Bottom Sticky Action Bar: Only visible on smaller screens */}
      <ActionBar
        status={details.session.status}
        roundNumber={currentRound}
        overallComment={overallComment}
        onOverallCommentChange={handleOverallCommentChange}
        onSubmitRevision={handleRequestRevision}
        onApprove={handleRequestApprove}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
