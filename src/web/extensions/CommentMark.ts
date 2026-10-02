import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

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
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeComment:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          tr.setMeta('allowCommentEdit', true);
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
        filterTransaction(tr, state) {
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

          // Block any ReplaceStep that modifies characters within or across a locked comment range
          for (const step of tr.steps) {
            if (step instanceof ReplaceStep || step.constructor.name === 'ReplaceStep') {
              const { from, to } = step as any;
              // Allow full document replacement (e.g. setContent or initial load)
              if (from === 0 && to >= state.doc.content.size) {
                continue;
              }
              for (const range of commentRanges) {
                const overlaps =
                  (from < range.to && to > range.from) ||
                  (from === to && from > range.from && from < range.to);
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
