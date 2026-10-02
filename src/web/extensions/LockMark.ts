import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

export interface LockMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lock: {
      setLock: (lockId: string) => ReturnType;
      unsetLock: () => ReturnType;
      removeLock: (lockId: string) => ReturnType;
    };
  }
}

export const LockMark = Mark.create<LockMarkOptions>({
  name: 'lock',
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      lockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-lock-id'),
        renderHTML: (attributes) => {
          if (!attributes.lockId) {
            return {};
          }
          return {
            'data-lock-id': attributes.lockId,
            class: 'pujangga-locked-highlight',
            title: 'Locked: This text is locked and will not be changed across revisions. Click to unlock.',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-lock-id]',
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
      setLock:
        (lockId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { lockId });
        },
      unsetLock:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeLock:
        (lockId: string) =>
        ({ tr, dispatch }) => {
          tr.setMeta('allowLockEdit', true);
          const lockMarkType = tr.doc.type.schema.marks.lock;
          if (lockMarkType) {
            tr.doc.descendants((node, pos) => {
              if (node.isText && node.marks) {
                const mark = node.marks.find(
                  (m) => m.type === lockMarkType && m.attrs.lockId === lockId
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
        key: new PluginKey('textLockGuard'),
        filterTransaction(tr, state) {
          if (!tr.docChanged) return true;
          // Explicit bypass for programmatic document loads or unlock operations
          if (tr.getMeta('allowLockEdit')) return true;

          const lockMarkType = state.schema.marks.lock;
          if (!lockMarkType) return true;

          // Find all text ranges that have a lock mark
          const lockedRanges: Array<{ from: number; to: number }> = [];
          state.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              if (node.marks.some((m) => m.type === lockMarkType)) {
                lockedRanges.push({ from: pos, to: pos + node.nodeSize });
              }
            }
          });

          if (lockedRanges.length === 0) return true;

          // Block any ReplaceStep that modifies characters within or across a locked range
          for (const step of tr.steps) {
            if (step instanceof ReplaceStep || step.constructor.name === 'ReplaceStep') {
              const { from, to } = step as any;
              // Allow full document replacement (e.g. setContent or initial load)
              if (from === 0 && to >= state.doc.content.size) {
                continue;
              }
              for (const range of lockedRanges) {
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
        key: new PluginKey('textLockStoredMarkGuard'),
        appendTransaction(transactions, oldState, newState) {
          const lockMarkType = newState.schema.marks.lock;
          if (
            lockMarkType &&
            newState.storedMarks &&
            newState.storedMarks.some((m) => m.type === lockMarkType)
          ) {
            const filtered = newState.storedMarks.filter((m) => m.type !== lockMarkType);
            return newState.tr.setStoredMarks(filtered);
          }
          return null;
        },
      }),
    ];
  },
});
