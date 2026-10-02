import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReplaceStep, AddMarkStep, RemoveMarkStep, ReplaceAroundStep } from '@tiptap/pm/transform';

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

function notifyLockViolation(message: string) {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(
      new CustomEvent('pujangga:locked-text-delete-attempt', {
        detail: { message },
      })
    );
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
        props: {
          handleKeyDown(view, event) {
            const { from, to } = view.state.selection;
            const lockMarkType = view.state.schema.marks.lock;
            if (!lockMarkType) return false;

            const isRangeSelection = from !== to;
            const rangeHasLock = isRangeSelection && view.state.doc.rangeHasMark(from, to, lockMarkType);

            // 1. Backspace / Delete
            if (event.key === 'Backspace' || event.key === 'Delete') {
              if (rangeHasLock) {
                notifyLockViolation('Cannot delete content containing locked text. Unlock the text segment first.');
                return true;
              }
              // Collapsed selection directly adjacent to locked text
              if (!isRangeSelection) {
                if (event.key === 'Backspace' && from > 0) {
                  const $pos = view.state.doc.resolve(from);
                  if ($pos.nodeBefore && $pos.nodeBefore.marks.some((m) => m.type === lockMarkType)) {
                    notifyLockViolation('Cannot delete locked text. Unlock the text segment first.');
                    return true;
                  }
                } else if (event.key === 'Delete' && to < view.state.doc.content.size) {
                  const $pos = view.state.doc.resolve(to);
                  if ($pos.nodeAfter && $pos.nodeAfter.marks.some((m) => m.type === lockMarkType)) {
                    notifyLockViolation('Cannot delete locked text. Unlock the text segment first.');
                    return true;
                  }
                }
              }
            }

            // 2. Cut (Cmd+X / Ctrl+X)
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
              if (rangeHasLock) {
                notifyLockViolation('Cannot cut content containing locked text. Unlock the text segment first.');
                return true;
              }
            }

            // 3. Typing any character over selection containing locked text
            if (rangeHasLock && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
              notifyLockViolation('Cannot overwrite content containing locked text. Unlock the text segment first.');
              return true;
            }

            return false;
          },
        },
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

          // Block any step that modifies characters or formatting within or across a locked range
          for (const step of tr.steps) {
            const stepName = step.constructor.name;
            if (step instanceof ReplaceStep || stepName === 'ReplaceStep') {
              const { from, to } = step as any;
              for (const range of lockedRanges) {
                const overlaps =
                  (from < range.to && to > range.from) ||
                  (from === to && from > range.from && from < range.to);
                if (overlaps) {
                  notifyLockViolation('Cannot delete or modify content containing locked text.');
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
              for (const range of lockedRanges) {
                const overlaps = from < range.to && to > range.from;
                if (overlaps) {
                  return false;
                }
              }
            } else if (
              stepName === 'AttrStep' ||
              stepName === 'AddNodeMarkStep' ||
              stepName === 'RemoveNodeMarkStep'
            ) {
              const { pos } = step as any;
              const node = state.doc.nodeAt(pos);
              if (node) {
                const nodeTo = pos + node.nodeSize;
                for (const range of lockedRanges) {
                  const overlaps = pos < range.to && nodeTo > range.from;
                  if (overlaps) {
                    return false;
                  }
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
