import React from 'react';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Quote,
  Code2,
  MessageSquarePlus,
  Lock,
} from 'lucide-react';

interface EditorialBubbleMenuProps {
  editor: any;
  disabled?: boolean;
  onAddComment: () => void;
  onLockText: () => void;
}

interface BubbleMenuState {
  isVisible: boolean;
  position: { top: number; left: number };
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isLink: boolean;
  isH1: boolean;
  isH2: boolean;
  isH3: boolean;
  isH4: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
}

const HIDDEN_STATE: BubbleMenuState = {
  isVisible: false,
  position: { top: 0, left: 0 },
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isCode: false,
  isLink: false,
  isH1: false,
  isH2: false,
  isH3: false,
  isH4: false,
  isBulletList: false,
  isOrderedList: false,
  isBlockquote: false,
  isCodeBlock: false,
};

export const EditorialBubbleMenu: React.FC<EditorialBubbleMenuProps> = ({
  editor,
  disabled = false,
  onAddComment,
  onLockText,
}) => {
  const menuState = useEditorState({
    editor,
    selector: (ctx): BubbleMenuState => {
      if (!ctx.editor || !ctx.editor.state || disabled) {
        return HIDDEN_STATE;
      }

      const ed = ctx.editor;
      const { from, to } = ed.state.selection;
      if (from === to) {
        return HIDDEN_STATE;
      }

      const lockMarkType = ed.state.schema.marks.lock;
      // If selection overlaps with locked text, hide formatting bubble menu
      if (lockMarkType && ed.state.doc.rangeHasMark(from, to, lockMarkType)) {
        return HIDDEN_STATE;
      }

      const text = ed.state.doc.textBetween(from, to, ' ');
      if (!text.trim()) {
        return HIDDEN_STATE;
      }

      let top = 0;
      let left = 0;
      if (ed.view) {
        try {
          const startCoords = ed.view.coordsAtPos(from);
          const endCoords = ed.view.coordsAtPos(to);
          top = Math.min(startCoords.top, endCoords.top);
          left = (startCoords.left + endCoords.left) / 2;
        } catch {
          // fallback if coordsAtPos fails during transition
          top = 0;
          left = 0;
        }
      }

      return {
        isVisible: true,
        position: { top, left },
        isBold: ed.isActive('bold'),
        isItalic: ed.isActive('italic'),
        isUnderline: ed.isActive('underline'),
        isStrike: ed.isActive('strike'),
        isCode: ed.isActive('code'),
        isLink: ed.isActive('link'),
        isH1: ed.isActive('heading', { level: 1 }),
        isH2: ed.isActive('heading', { level: 2 }),
        isH3: ed.isActive('heading', { level: 3 }),
        isH4: ed.isActive('heading', { level: 4 }),
        isBulletList: ed.isActive('bulletList'),
        isOrderedList: ed.isActive('orderedList'),
        isBlockquote: ed.isActive('blockquote'),
        isCodeBlock: ed.isActive('codeBlock'),
      };
    },
  });

  if (!editor || !menuState || !menuState.isVisible) return null;

  const handleLink = () => {
    if (!editor) return;
    if (menuState.isLink) {
      const currentUrl = editor.getAttributes('link').href || '';
      const url = window.prompt('Edit URL (leave blank to remove link):', currentUrl);
      if (url === null) return;
      if (!url.trim()) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
      return;
    }

    const url = window.prompt('Enter link URL (e.g. https://example.com):', 'https://');
    if (!url || !url.trim()) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const btnClass = (isActive: boolean = false) =>
    `p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
      isActive
        ? 'bg-accent-subtle dark:bg-accent-subtle-dark text-accent dark:text-accent-pin font-bold shadow-xs ring-1 ring-accent-border dark:ring-accent-border-dark'
        : 'text-ink-secondary dark:text-night-text-muted hover:text-ink dark:hover:text-night-text hover:bg-paper-hover dark:hover:bg-night-hover'
    }`;

  return (
    <div
      className="fixed z-60 transform -translate-x-1/2 -translate-y-full mb-2.5 bg-paper-card/95 dark:bg-night-card text-ink dark:text-night-text p-1.5 rounded-xl shadow-xl dark:shadow-2xl flex items-center gap-1 text-sm font-medium select-none border border-paper-border dark:border-night-border-strong backdrop-blur-md max-w-[calc(100vw-32px)] overflow-x-auto scrollbar-none animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: Math.max(70, menuState.position.top - 8),
        left: Math.max(220, Math.min(window.innerWidth - 220, menuState.position.left)),
      }}
    >
      {/* Headings H1 to H4 */}
      <button
        type="button"
        title="Heading 1 (⌘+Alt+1)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(menuState.isH1)}
      >
        <Heading1 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Heading 2 (⌘+Alt+2)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(menuState.isH2)}
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Heading 3 (⌘+Alt+3)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(menuState.isH3)}
      >
        <Heading3 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Heading 4 (⌘+Alt+4)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        className={btnClass(menuState.isH4)}
      >
        <Heading4 className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-paper-border dark:bg-night-border mx-1 shrink-0" />

      {/* Inline Marks: Bold, Italic, Underline, Strike, Code, Link */}
      <button
        type="button"
        title="Bold (⌘+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(menuState.isBold)}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Italic (⌘+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(menuState.isItalic)}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Underline (⌘+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(menuState.isUnderline)}
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Strikethrough (⌘+Shift+X)"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(menuState.isStrike)}
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Inline Code (⌘+E)"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btnClass(menuState.isCode)}
      >
        <Code className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title={menuState.isLink ? 'Edit / Remove Link (⌘+K)' : 'Insert Link (⌘+K)'}
        onClick={handleLink}
        className={btnClass(menuState.isLink)}
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-paper-border dark:bg-night-border mx-1 shrink-0" />

      {/* Block Elements: Bullet List, Ordered List, Blockquote, Code Block */}
      <button
        type="button"
        title="Bullet List (Unordered) (⌘+Shift+8)"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(menuState.isBulletList)}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Numbered List (Ordered) (⌘+Shift+7)"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(menuState.isOrderedList)}
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Blockquote (⌘+Shift+B)"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(menuState.isBlockquote)}
      >
        <Quote className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Code Block (⌘+Alt+C)"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass(menuState.isCodeBlock)}
      >
        <Code2 className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-paper-border dark:bg-night-border mx-1 shrink-0" />

      {/* Actions: Add Note, Lock Text */}
      <button
        type="button"
        onClick={onAddComment}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold hover:bg-accent-subtle dark:hover:bg-accent-subtle-dark text-accent dark:text-accent-pin transition-colors cursor-pointer shrink-0"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
        <span>Add Note</span>
      </button>
      <div className="w-[1px] h-4 bg-paper-border dark:bg-night-border mx-0.5 shrink-0" />
      <button
        type="button"
        onClick={onLockText}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold hover:bg-success-subtle dark:hover:bg-success-subtle-dark text-success dark:text-success-icon-dark transition-colors cursor-pointer shrink-0"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>Lock Text</span>
      </button>
    </div>
  );
};
