import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { CommentMark } from '../src/web/extensions/CommentMark.js';
import { LockMark } from '../src/web/extensions/LockMark.js';
import { generateAgentReport } from '../src/shared/reporter.js';
import { DatabaseService } from '../src/daemon/db.js';

function testCommentLock() {
  console.log('--- 1. Testing Comment Locking & Removal ---');

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
}

function testLockMarkGuard() {
  console.log('--- 2. Testing LockMark Extension & Guard ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*' },
      text: { inline: true },
    },
    marks: {
      lock: {
        attrs: { lockId: { default: null } },
      },
    },
  });

  const lockMarkType = schema.marks.lock;
  const l1Mark = lockMarkType.create({ lockId: 'lock-1' });

  // Create document: "The [unalterable thesis] must remain."
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('The '),
      schema.text('unalterable thesis', [l1Mark]),
      schema.text(' must remain.'),
    ]),
  ]);

  const plugins = LockMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const state = EditorState.create({ doc, schema, plugins });

  // 1. Try to edit inside 'unalterable thesis'
  const trBlocked = state.tr.replaceWith(6, 12, schema.text('changed'));
  let wasBlocked = false;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trBlocked, state)) {
      wasBlocked = true;
      break;
    }
  }

  if (!wasBlocked) {
    throw new Error('Expected edit inside locked text to be BLOCKED, but was allowed!');
  }
  console.log('✓ Editing or deleting locked text is successfully BLOCKED!');

  // 2. Try to edit outside locked text
  const trAllowed = state.tr.replaceWith(1, 4, schema.text('This'));
  let wasAllowed = true;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trAllowed, state)) {
      wasAllowed = false;
      break;
    }
  }

  if (!wasAllowed) {
    throw new Error('Expected edit outside locked text to be ALLOWED, but was blocked!');
  }
  console.log('✓ Editing outside locked text is ALLOWED!');

  // 3. Test unlocking via meta
  const trUnlock = state.tr;
  trUnlock.setMeta('allowLockEdit', true);
  trUnlock.doc.descendants((node, pos) => {
    if (node.isText && node.marks) {
      const m = node.marks.find((m) => m.type === lockMarkType && m.attrs.lockId === 'lock-1');
      if (m) {
        trUnlock.removeMark(pos, pos + node.nodeSize, m);
      }
    }
  });

  const nextState = state.apply(trUnlock);
  let remainingLockMarks = 0;
  nextState.doc.descendants((node) => {
    if (node.isText && node.marks) {
      remainingLockMarks += node.marks.filter((m) => m.type === lockMarkType).length;
    }
  });

  if (remainingLockMarks !== 0) {
    throw new Error('Lock mark was not removed!');
  }
  console.log('✓ Lock mark successfully removed upon unlock!');
}

function testAgentReportWithLockedText() {
  console.log('--- 3. Testing Agent Report with Locked Text ---');

  const report = generateAgentReport({
    status: 'NEEDS_REVISION',
    roundNumber: 2,
    filePath: '/path/to/essay.md',
    originalMarkdown: 'Introduction paragraph.\n\nLocked core finding.\n\nConclusion.\n',
    userEditedMarkdown: 'Introduction paragraph.\n\nLocked core finding.\n\nConclusion.\n',
    overallComment: 'Refine introduction style.',
    inlineComments: [
      {
        anchorText: 'Introduction',
        commentText: 'Make this punchier.',
      },
    ],
    lockedTexts: [
      {
        id: 'lock-core',
        text: 'Locked core finding.',
      },
    ],
  });

  if (!report.includes('## 🔒 Locked Text Segments (CRITICAL: DO NOT MODIFY)')) {
    throw new Error('Report missing Locked Text Segments header!');
  }
  if (!report.includes('The reviewer has locked the following text segment(s). They MUST remain VERBATIM in your revision')) {
    throw new Error('Report missing verbatim preservation directive!');
  }
  if (!report.includes('1. "Locked core finding."')) {
    throw new Error('Report missing verbatim locked text snippet!');
  }
  if (!report.includes('Ensure all 🔒 Locked Text Segments')) {
    throw new Error('Report missing next steps directive for locked text segments!');
  }

  console.log('✓ Agent report correctly includes locked text section and immutability directive!');
}

function testDatabaseLockedTextPersistence() {
  console.log('--- 4. Testing SQLite Locked Text Persistence Across Rounds & Session Finalization ---');

  const db = new DatabaseService(':memory:');
  const filePath = '/tmp/pujangga-test-essay.md';

  // 1. Register Round 1
  const { session, revision: rev1 } = db.registerSession(filePath, '/tmp', '# Essay\n\nPreserved thesis.');
  console.log(`✓ Session created: ${session.id}, Round 1 ID: ${rev1.id}`);

  // 2. Add locked text in Round 1
  const locked1 = db.addLockedText(session.id, {
    text: 'Preserved thesis.',
    roundNumber: 1,
  });
  console.log(`✓ Locked text added: "${locked1.text}" (id: ${locked1.id})`);

  let currentLocks = db.getLockedTexts(session.id);
  if (currentLocks.length !== 1 || currentLocks[0].text !== 'Preserved thesis.') {
    throw new Error(`Expected 1 locked text, got ${currentLocks.length}`);
  }

  // 3. Submit Round 1 review (NEEDS_REVISION)
  db.submitReview(session.id, rev1.id, {
    userEditedMarkdown: '# Essay\n\nPreserved thesis.',
    overallComment: 'Expand discussion.',
    status: 'NEEDS_REVISION',
    inlineComments: [],
    lockedTexts: [{ id: locked1.id, text: locked1.text }],
  });

  // 4. Agent registers Round 2
  const { revision: rev2, isNewRound } = db.registerSession(
    filePath,
    '/tmp',
    '# Essay\n\nPreserved thesis.\n\nExpanded discussion added by agent.'
  );
  if (!isNewRound || rev2.roundNumber !== 2) {
    throw new Error(`Expected round 2, got round ${rev2.roundNumber}`);
  }
  console.log(`✓ Round 2 registered: ID: ${rev2.id}`);

  // 5. Verify locked text persisted into Round 2!
  const round2Locks = db.getLockedTexts(session.id);
  if (round2Locks.length !== 1 || round2Locks[0].text !== 'Preserved thesis.') {
    throw new Error(`Expected locked text to persist into Round 2, found ${round2Locks.length}`);
  }
  console.log(`✓ Locked text successfully persisted across round transition!`);

  // 6. Human finalizes session as SATISFIED
  db.submitReview(session.id, rev2.id, {
    userEditedMarkdown: '# Essay\n\nPreserved thesis.\n\nExpanded discussion added by agent.',
    overallComment: 'Approved!',
    status: 'SATISFIED',
    inlineComments: [],
  });

  // 7. Verify locked texts are cleared upon SATISFIED
  const afterSatisfiedLocks = db.getLockedTexts(session.id);
  if (afterSatisfiedLocks.length !== 0) {
    throw new Error(`Expected locked texts to be cleared upon SATISFIED, found ${afterSatisfiedLocks.length}`);
  }
  console.log(`✓ Locked texts successfully cleaned up upon session finalization (SATISFIED)!`);
}

function runAll() {
  testCommentLock();
  testLockMarkGuard();
  testAgentReportWithLockedText();
  testDatabaseLockedTextPersistence();
  console.log('\n=== All Text Locking Tests Passed! ===\n');
}

runAll();
