import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReplaceStep, AddMarkStep, RemoveMarkStep, ReplaceAroundStep } from '@tiptap/pm/transform';
import { closeHistory, isHistoryTransaction } from '@tiptap/pm/history';

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: () => ReturnType;
      removeComment: (commentId: string) => ReturnType;
    };
  }
}

function notifyCommentViolation(message: string) {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(
      new CustomEvent('pujangga:noted-text-delete-attempt', {
        detail: { message },
      })
    );
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'comment',
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
            class: 'pujangga-comment-highlight',
            title: 'Locked: This text has an inline note. Click the note to remove it before editing.',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          const { empty, ranges } = tr.selection;
          if (empty) return false;
          const commentMarkType = tr.doc.type.schema.marks.comment;
          if (!commentMarkType) return false;
          tr.setMeta('allowCommentEdit', true);
          tr.setMeta('addToHistory', false);
          closeHistory(tr);
          for (const range of ranges) {
            tr.addMark(range.$from.pos, range.$to.pos, commentMarkType.create({ commentId }));
          }
          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },
      unsetComment:
        () =>
        ({ tr, dispatch }) => {
          const { empty, ranges } = tr.selection;
          if (empty) return false;
          const commentMarkType = tr.doc.type.schema.marks.comment;
          if (!commentMarkType) return false;
          tr.setMeta('allowCommentEdit', true);
          tr.setMeta('addToHistory', false);
          closeHistory(tr);
          for (const range of ranges) {
            tr.removeMark(range.$from.pos, range.$to.pos, commentMarkType);
          }
          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },
      removeComment:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          tr.setMeta('allowCommentEdit', true);
          tr.setMeta('addToHistory', false);
          closeHistory(tr);
          const commentMarkType = tr.doc.type.schema.marks.comment;
          if (commentMarkType) {
            tr.doc.descendants((node, pos) => {
              if (node.isText && node.marks) {
                const mark = node.marks.find(
                  (m) => m.type === commentMarkType && m.attrs.commentId === commentId
                );
                if (mark) {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                }
              }
            });
            if (tr.docChanged && dispatch) {
              dispatch(tr);
            }
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('commentLock'),
        props: {
          handleKeyDown(view, event) {
            const { from, to } = view.state.selection;
            const commentMarkType = view.state.schema.marks.comment;
            if (!commentMarkType) return false;

            const isRangeSelection = from !== to;
            const rangeHasComment = isRangeSelection && view.state.doc.rangeHasMark(from, to, commentMarkType);

            // If range also has locked text, let LockMark handle it with its own lock notification
            const lockMarkType = view.state.schema.marks.lock;
            const rangeHasLock = isRangeSelection && lockMarkType && view.state.doc.rangeHasMark(from, to, lockMarkType);

            // 1. Backspace / Delete
            if (event.key === 'Backspace' || event.key === 'Delete') {
              if (rangeHasComment) {
                if (rangeHasLock) return false;
                notifyCommentViolation('Cannot delete content containing active notes. Remove or resolve the note first.');
                return true;
              }
              // Collapsed selection directly adjacent to commented text
              if (!isRangeSelection) {
                if (event.key === 'Backspace' && from > 0) {
                  const $pos = view.state.doc.resolve(from);
                  if ($pos.nodeBefore && $pos.nodeBefore.marks.some((m) => m.type === commentMarkType)) {
                    notifyCommentViolation('Cannot delete noted text. Remove or resolve the note first.');
                    return true;
                  }
                } else if (event.key === 'Delete' && to < view.state.doc.content.size) {
                  const $pos = view.state.doc.resolve(to);
                  if ($pos.nodeAfter && $pos.nodeAfter.marks.some((m) => m.type === commentMarkType)) {
                    notifyCommentViolation('Cannot delete noted text. Remove or resolve the note first.');
                    return true;
                  }
                }
              }
            }

            // 2. Cut (Cmd+X / Ctrl+X)
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
              if (rangeHasComment) {
                if (rangeHasLock) return false;
                notifyCommentViolation('Cannot cut content containing active notes. Remove or resolve the note first.');
                return true;
              }
            }

            // 3. Typing any character over selection containing commented text
            if (rangeHasComment && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
              if (rangeHasLock) return false;
              notifyCommentViolation('Cannot overwrite content containing active notes. Remove or resolve the note first.');
              return true;
            }

            return false;
          },
        },
        filterTransaction(tr, state) {
          // Any transaction that adds or removes comment marks must not be added to history
          const hasCommentMarkStep = tr.steps.some((step: any) => {
            const name = step.constructor.name;
            if (name === 'AddMarkStep' || name === 'RemoveMarkStep') {
              return step.mark?.type?.name === 'comment';
            }
            return false;
          });

          if (hasCommentMarkStep) {
            // Block undo/redo history from altering comment marks
            if (isHistoryTransaction(tr)) {
              return false;
            }
            tr.setMeta('addToHistory', false);
            closeHistory(tr);
          }

          if (!tr.docChanged) return true;
          // Explicit bypass for programmatic document loads or comment removals
          if (tr.getMeta('allowCommentEdit')) return true;

          const commentMarkType = state.schema.marks.comment;
          if (!commentMarkType) return true;

          // Find all text ranges that have a comment mark
          const commentRanges: Array<{ from: number; to: number }> = [];
          state.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              if (node.marks.some((m) => m.type === commentMarkType)) {
                commentRanges.push({ from: pos, to: pos + node.nodeSize });
              }
            }
          });

          if (commentRanges.length === 0) return true;

          const lockMarkType = state.schema.marks.lock;

          // Block any step that modifies characters or formatting within or across a locked comment range
          for (const step of tr.steps) {
            const stepName = step.constructor.name;
            if (step instanceof ReplaceStep || stepName === 'ReplaceStep') {
              const { from, to } = step as any;
              for (const range of commentRanges) {
                const overlaps =
                  (from < range.to && to > range.from) ||
                  (from === to && from > range.from && from < range.to);
                if (overlaps) {
                  if (lockMarkType && state.doc.rangeHasMark(from, to, lockMarkType)) {
                    return false;
                  }
                  notifyCommentViolation('Cannot delete or modify content containing active notes.');
                  return false;
                }
              }
            } else if (
              step instanceof AddMarkStep ||
              stepName === 'AddMarkStep' ||
              step instanceof RemoveMarkStep ||
              stepName === 'RemoveMarkStep' ||
              step instanceof ReplaceAroundStep ||
              stepName === 'ReplaceAroundStep'
            ) {
              const { from, to } = step as any;
              for (const range of commentRanges) {
                const overlaps = from < range.to && to > range.from;
                if (overlaps) {
                  return false;
                }
              }
            }
          }

          return true;
        },
      }),
      new Plugin({
        key: new PluginKey('commentStoredMarkGuard'),
        appendTransaction(transactions, oldState, newState) {
          const commentMarkType = newState.schema.marks.comment;
          if (
            commentMarkType &&
            newState.storedMarks &&
            newState.storedMarks.some((m) => m.type === commentMarkType)
          ) {
            const filtered = newState.storedMarks.filter((m) => m.type !== commentMarkType);
            return newState.tr.setStoredMarks(filtered);
          }
          return null;
        },
      }),
    ];
  },
});
