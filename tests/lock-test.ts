import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { CommentMark } from '../src/web/extensions/CommentMark.js';
import StarterKit from '@tiptap/starter-kit';

function testCommentLock() {
  console.log('--- Testing Comment Locking & Removal ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*' },
      text: { inline: true },
    },
    marks: {
      comment: {
        attrs: { commentId: { default: null } },
      },
    },
  });

  const commentMarkType = schema.marks.comment;
  const c1Mark = commentMarkType.create({ commentId: 'c1' });

  // Create document: "Hello [world (with comment)]!"
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Hello '),
      schema.text('world', [c1Mark]),
      schema.text('!'),
    ]),
  ]);

  const plugins = CommentMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const state = EditorState.create({ doc, schema, plugins });

  // 1. Try to edit inside 'world' (positions 7 to 12)
  const trBlocked = state.tr.replaceWith(8, 9, schema.text('X'));
  let wasBlocked = false;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trBlocked, state)) {
      wasBlocked = true;
      break;
    }
  }

  if (!wasBlocked) {
    throw new Error('Expected edit inside comment to be BLOCKED, but was allowed!');
  }
  console.log('✓ Editing or deleting text with an active note is successfully BLOCKED!');

  // 2. Try to edit outside 'world' (positions 1 to 5)
  const trAllowed = state.tr.replaceWith(1, 5, schema.text('Hi'));
  let wasAllowed = true;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trAllowed, state)) {
      wasAllowed = false;
      break;
    }
  }

  if (!wasAllowed) {
    throw new Error('Expected edit outside comment to be ALLOWED, but was blocked!');
  }
  console.log('✓ Editing outside comment ranges is ALLOWED!');

  // 3. Test removing comment mark
  const trRemove = state.tr;
  trRemove.setMeta('allowCommentEdit', true);
  trRemove.doc.descendants((node, pos) => {
    if (node.isText && node.marks) {
      const m = node.marks.find((m) => m.type === commentMarkType && m.attrs.commentId === 'c1');
      if (m) {
        trRemove.removeMark(pos, pos + node.nodeSize, m);
      }
    }
  });

  const nextState = state.apply(trRemove);
  const hasMarksLeft = nextState.doc.textContent.length === 12;
  let remainingCommentMarks = 0;
  nextState.doc.descendants((node) => {
    if (node.isText && node.marks) {
      remainingCommentMarks += node.marks.filter((m) => m.type === commentMarkType).length;
    }
  });

  if (remainingCommentMarks !== 0) {
    throw new Error('Comment mark was not removed!');
  }
  console.log('✓ Comment mark successfully removed, unlocking text for future edits!');

  console.log('=== All Comment Lock Tests Passed! ===');
}

testCommentLock();
