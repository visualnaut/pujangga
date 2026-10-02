import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { CommentMark } from './extensions/CommentMark.js';
import { Navbar } from './components/Navbar.js';
import { ActionBar } from './components/ActionBar.js';
import { DesktopSidebar } from './components/DesktopSidebar.js';
import { DiffViewer } from './components/DiffViewer.js';
import { CommentHistoryDrawer } from './components/CommentHistoryDrawer.js';
import { CommentPopover, CommentPopoverData } from './components/CommentPopover.js';
import { SessionDetails, InlineComment, ReviewStatus } from '../shared/types.js';
import { MessageSquarePlus, CheckCircle2, Feather, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [selectedLeftRound, setSelectedLeftRound] = useState<number>(1);
  const [selectedRightRound, setSelectedRightRound] = useState<number>(1);
  const [isCommentHistoryOpen, setIsCommentHistoryOpen] = useState(false);
  const [overallComment, setOverallComment] = useState('');
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
  const [selectionTooltip, setSelectionTooltip] = useState<{
    text: string;
    position: { top: number; left: number };
  } | null>(null);

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
            msg.type === 'SESSION_SATISFIED'
          ) {
            const updatedDetails: SessionDetails = msg.payload;
            setDetails(updatedDetails);
            setLocalComments(updatedDetails.comments || []);

            // If a new round was pushed by agent, update editor text!
            if (msg.type === 'ROUND_UPDATED' && editor) {
              const newContent = updatedDetails.currentRevision?.contentMarkdown || '';
              editor.commands.setContent(newContent);
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
        heading: { levels: [1, 2, 3] },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      CommentMark,
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
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelectionTooltip(null);
        return;
      }

      const text = editor.state.doc.textBetween(from, to, ' ');
      if (!text.trim()) {
        setSelectionTooltip(null);
        return;
      }

      const view = editor.view;
      const coords = view.coordsAtPos(to);

      setSelectionTooltip({
        text: text.trim(),
        position: {
          top: coords.top,
          left: coords.left,
        },
      });
    },
  });

  // Sync content into editor on first load or when revision id changes
  const prevRevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (editor && details?.currentRevision) {
      if (prevRevIdRef.current !== details.currentRevision.id) {
        prevRevIdRef.current = details.currentRevision.id;
        editor.commands.setContent(details.currentRevision.contentMarkdown);
      }
    }
  }, [editor, details?.currentRevision]);

  // Handle clicking on comment highlights in the editor
  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
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

    const el = document.querySelector('.editorial-prose');
    if (el) {
      el.addEventListener('click', handleEditorClick as any);
      return () => el.removeEventListener('click', handleEditorClick as any);
    }
  }, [localComments]);

  // Add Comment from selection tooltip
  const handleAddCommentFromSelection = () => {
    if (!editor || !selectionTooltip) return;

    const { from, to } = editor.state.selection;
    const commentId = crypto.randomUUID();
    const anchorText = selectionTooltip.text;

    // Apply comment mark to the selected text
    editor.chain().focus().setComment(commentId).run();

    setPopoverData({
      commentId,
      anchorText,
      commentText: '',
      isNew: true,
      position: selectionTooltip.position,
    });

    setSelectionTooltip(null);
  };

  // Save comment in local state
  const handleSaveComment = (commentId: string, text: string) => {
    if (!details?.currentRevision) return;

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
        setSelectedLeftRound(prevRound);
        setSelectedRightRound(current);
      }
      return next;
    });
  };

  // Submit review round
  const submitReview = async (status: ReviewStatus) => {
    if (!editor || !details) return;

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
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit review');
      }

      setOverallComment('');
      await fetchSession();
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#121110]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 dark:text-amber-500" />
          <p className="text-sm font-serif text-[#706B65] dark:text-[#A8A29D]">Opening Pujangga review canvas...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF8F5] dark:bg-[#121110]">
        <div className="max-w-md w-full bg-white dark:bg-[#1E1C1A] border border-[#E6E0D4] dark:border-[#38332E] rounded-2xl p-6 text-center shadow-lg">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 mx-auto flex items-center justify-center mb-4">
            <Feather className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-serif mb-2 text-[#2C2825] dark:text-[#E8E6E3]">No Active Review Session</h2>
          <p className="text-sm text-[#706B65] dark:text-[#A8A29D] mb-6">
            {error || 'Start a review by executing `pujangga <filepath>` from your terminal or agent harness.'}
          </p>
          <div className="text-xs bg-[#FAF8F5] dark:bg-[#141312] p-3 rounded-lg font-mono text-[#8C827A] border border-[#EFEAE1] dark:border-[#2C2825]">
            $ npx -y pujangga draft.md
          </div>
        </div>
      </div>
    );
  }

  const currentRound = details.currentRevision?.roundNumber || 1;
  const hasMultipleRounds = details.revisions.length >= 2;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2C2825] dark:bg-[#121110] dark:text-[#EDEAE4] transition-colors pb-24 lg:pb-12">
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
        isDark={isDark}
        onToggleTheme={() => setIsDark((v) => !v)}
      />

      {/* Main Container: Flex Row on Desktop (Canvas + Right Sidebar), Stack on Mobile */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8 items-start">
        {/* Left/Center Editorial Reading & Writing Canvas */}
        <main className="flex-1 min-w-0 w-full relative">
          {/* Waiting State Notice on Mobile/Tablet */}
          {details.session.status === 'revising' && (
            <div className="lg:hidden mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Agent is revising Round {currentRound}...
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80">
                  Keep this tab open. It will automatically update once the agent completes the revision.
                </p>
              </div>
            </div>
          )}

          {/* Satisfied Celebration Notice on Mobile/Tablet */}
          {details.session.status === 'satisfied' && (
            <div className="lg:hidden mb-6 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100 font-serif">
                  Review Concluded & Approved!
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                  The target file on disk contains your approved text.
                </p>
              </div>
            </div>
          )}

          {/* Selection Tooltip for Adding Notes */}
          {selectionTooltip && details.session.status === 'active' && !showDiff && (
            <div
              className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-[#2C2825] dark:bg-[#FAF8F5] text-white dark:text-[#121110] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:scale-105 transition-all select-none animate-in fade-in zoom-in-95 border border-black/10 dark:border-white/10"
              style={{
                top: selectionTooltip.position.top - 8,
                left: selectionTooltip.position.left,
              }}
              onClick={handleAddCommentFromSelection}
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
              <span>Add Note</span>
            </div>
          )}

          {/* Side-by-Side Diff View or In-Place Editor */}
          {showDiff && details ? (
            <DiffViewer
              revisions={details.revisions}
              selectedLeftRound={selectedLeftRound}
              selectedRightRound={selectedRightRound}
              onSelectLeftRound={setSelectedLeftRound}
              onSelectRightRound={setSelectedRightRound}
              onClose={() => setShowDiff(false)}
            />
          ) : (
            <div className="bg-white dark:bg-[#1A1816] rounded-2xl border border-[#E6E0D4] dark:border-[#38332E] p-6 sm:p-10 md:p-14 shadow-xs transition-colors">
              <EditorContent editor={editor} />
            </div>
          )}
        </main>

        {/* Right Sidebar on Desktop Viewport */}
        <DesktopSidebar
          status={details.session.status}
          roundNumber={currentRound}
          overallComment={overallComment}
          onOverallCommentChange={setOverallComment}
          onSubmitRevision={() => submitReview('NEEDS_REVISION')}
          onApprove={() => submitReview('SATISFIED')}
          isSubmitting={isSubmitting}
          totalCommentsCount={localComments.length}
          onOpenCommentHistory={() => setIsCommentHistoryOpen(true)}
        />
      </div>

      {/* Floating Comment Popover */}
      <CommentPopover
        data={popoverData}
        onSave={handleSaveComment}
        onDelete={handleDeleteComment}
        onClose={handleClosePopover}
      />

      {/* Comment History Drawer */}
      <CommentHistoryDrawer
        isOpen={isCommentHistoryOpen}
        onClose={() => setIsCommentHistoryOpen(false)}
        comments={localComments}
        revisions={details.revisions}
        currentRound={currentRound}
      />

      {/* Bottom Sticky Action Bar: Only visible on smaller screens */}
      <ActionBar
        status={details.session.status}
        roundNumber={currentRound}
        overallComment={overallComment}
        onOverallCommentChange={setOverallComment}
        onSubmitRevision={() => submitReview('NEEDS_REVISION')}
        onApprove={() => submitReview('SATISFIED')}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
