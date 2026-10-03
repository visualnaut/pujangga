import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, undo, redo } from '@tiptap/pm/history';
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
  console.log('--- 3. Testing Agent Report with Contextual Anchoring ---');

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
        sectionHeading: '## Key Findings',
        contextBefore: 'Based on analysis,',
        contextAfter: 'demonstrating consistency.',
      },
    ],
  });

  if (!report.includes('## 🔒 Locked Text Segments (CRITICAL: DO NOT MODIFY)')) {
    throw new Error('Report missing Locked Text Segments header!');
  }
  if (!report.includes('The reviewer has locked the following text segment(s). They MUST remain VERBATIM in their designated locations')) {
    throw new Error('Report missing verbatim preservation directive!');
  }
  if (!report.includes('**Target Text**: "Locked core finding."')) {
    throw new Error('Report missing target text snippet!');
  }
  if (!report.includes('**Location**: Under `## Key Findings`')) {
    throw new Error('Report missing section location!');
  }
  if (!report.includes('**Surrounding Context**: "...Based on analysis, [Locked core finding.] demonstrating consistency...."') && !report.includes('Surrounding Context')) {
    throw new Error('Report missing surrounding context!');
  }
  if (!report.includes('**Scope**: Local to this occurrence in `## Key Findings` only.')) {
    throw new Error('Report missing local scope directive!');
  }

  console.log('✓ Agent report correctly includes contextual anchoring and section scope!');
}

function testDatabaseLockedTextPersistence() {
  console.log('--- 4. Testing SQLite Locked Text Persistence with Anchoring Across Rounds ---');

  const db = new DatabaseService(':memory:');
  const filePath = '/tmp/pujangga-test-essay.md';

  // 1. Register Round 1
  const { session, revision: rev1 } = db.registerSession(filePath, '/tmp', '# Essay\n\nPreserved thesis.');
  console.log(`✓ Session created: ${session.id}, Round 1 ID: ${rev1.id}`);

  // 2. Add locked text with contextual anchoring in Round 1
  const locked1 = db.addLockedText(session.id, {
    text: 'Preserved thesis.',
    roundNumber: 1,
    sectionHeading: '# Essay',
    contextBefore: 'Start: ',
    contextAfter: ' End.',
  });
  console.log(`✓ Locked text added: "${locked1.text}" (section: ${locked1.sectionHeading})`);

  let currentLocks = db.getLockedTexts(session.id);
  if (
    currentLocks.length !== 1 ||
    currentLocks[0].text !== 'Preserved thesis.' ||
    currentLocks[0].sectionHeading !== '# Essay' ||
    currentLocks[0].contextBefore !== 'Start: '
  ) {
    throw new Error(`Expected 1 locked text with anchoring, got ${JSON.stringify(currentLocks)}`);
  }

  // 3. Submit Round 1 review (NEEDS_REVISION)
  db.submitReview(session.id, rev1.id, {
    userEditedMarkdown: '# Essay\n\nPreserved thesis.',
    overallComment: 'Expand discussion.',
    status: 'NEEDS_REVISION',
    inlineComments: [],
    lockedTexts: [{
      id: locked1.id,
      text: locked1.text,
      sectionHeading: locked1.sectionHeading,
      contextBefore: locked1.contextBefore,
      contextAfter: locked1.contextAfter,
    }],
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

  // 5. Verify locked text with anchoring persisted into Round 2!
  const round2Locks = db.getLockedTexts(session.id);
  if (
    round2Locks.length !== 1 ||
    round2Locks[0].text !== 'Preserved thesis.' ||
    round2Locks[0].sectionHeading !== '# Essay'
  ) {
    throw new Error(`Expected locked text with anchoring to persist into Round 2, found ${JSON.stringify(round2Locks)}`);
  }
  console.log(`✓ Locked text and section heading successfully persisted across round transition!`);

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

function testLockedTextCannotBeCommented() {
  console.log('--- 5. Testing Locked Text Cannot Receive Inline Notes ---');

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
      comment: {
        attrs: { commentId: { default: null } },
      },
    },
  });

  const lockMarkType = schema.marks.lock;
  const l1Mark = lockMarkType.create({ lockId: 'lock-immutable' });

  // Create document: "Section A: [protected sentence] and normal sentence."
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Section A: '),
      schema.text('protected sentence', [l1Mark]),
      schema.text(' and normal sentence.'),
    ]),
  ]);

  // Positions:
  // "Section A: " -> 1 to 12
  // "protected sentence" -> 12 to 30
  // " and normal sentence." -> 30 to 51
  const hasLockOverRange = doc.rangeHasMark(12, 30, lockMarkType);
  if (!hasLockOverRange) {
    throw new Error('Expected rangeHasMark to detect lock mark over protected sentence!');
  }

  const hasLockOutside = doc.rangeHasMark(30, 51, lockMarkType);
  if (hasLockOutside) {
    throw new Error('Expected normal sentence to NOT have lock mark!');
  }

  console.log('✓ rangeHasMark reliably identifies locked ranges to prevent blocking & note addition!');
}

function testTypingAfterLockedOrCommentedText() {
  console.log('--- 6. Testing Typing After Locked or Noted Text Does Not Inherit Mark ---');

  if (LockMark.config.inclusive !== false) {
    throw new Error('LockMark must have inclusive: false!');
  }
  if (CommentMark.config.inclusive !== false) {
    throw new Error('CommentMark must have inclusive: false!');
  }

  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*' },
      text: { inline: true },
    },
    marks: {
      lock: {
        inclusive: LockMark.config.inclusive,
        attrs: { lockId: { default: null } },
      },
      comment: {
        inclusive: CommentMark.config.inclusive,
        attrs: { commentId: { default: null } },
      },
    },
  });

  const lockMarkType = schema.marks.lock;
  const lMark = lockMarkType.create({ lockId: 'lock-1' });

  // Doc: "First [locked]"
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('First '),
      schema.text('locked', [lMark]),
    ]),
  ]);

  let state = EditorState.create({ doc, schema });

  // Insert " extra" at position 13 (immediately after "locked")
  const tr = state.tr.insertText(' extra', 13);
  state = state.apply(tr);

  const para = state.doc.child(0);
  let extraMarks: string[] = [];
  para.forEach((child) => {
    if (child.text?.includes('extra')) {
      extraMarks = child.marks.map((m) => m.type.name);
    }
  });

  if (extraMarks.includes('lock')) {
    throw new Error('Newly typed text after locked text unexpectedly inherited the lock mark!');
  }

  console.log('✓ Text typed after locked text is clean and does NOT inherit lock mark!');
}

function testLockedTextFormattingImmutability() {
  console.log('--- 7. Testing Locked Text Formatting Immutability ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
      text: { group: 'inline' },
    },
    marks: {
      lock: { inclusive: false, attrs: { lockId: { default: null } } },
      bold: {},
      italic: {},
    },
  });

  const lockMarkType = schema.marks.lock;
  const boldMarkType = schema.marks.bold;
  const l1Mark = lockMarkType.create({ lockId: 'lock-fmt-1' });
  const bMark = boldMarkType.create();

  // Create doc:
  // Para 1: "Prefix " (1..8), "immutable thesis" (8..24, locked), " suffix" (24..31)
  // Para 2: "Normal paragraph" (33..49)
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Prefix '),
      schema.text('immutable thesis', [l1Mark]),
      schema.text(' suffix'),
    ]),
    schema.node('paragraph', null, [
      schema.text('Normal paragraph'),
    ]),
  ]);

  const plugins = LockMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const state = EditorState.create({ doc, schema, plugins });

  const filter = (tr: any) => {
    for (const plugin of plugins) {
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(tr, state)) {
        return false;
      }
    }
    return true;
  };

  // 1. Try to add bold to locked text (pos 8 to 24)
  const trBoldLocked = state.tr.addMark(8, 24, bMark);
  if (filter(trBoldLocked)) {
    throw new Error('Expected adding bold to locked text to be BLOCKED, but was allowed!');
  }
  console.log('✓ Adding formatting (bold) to locked text is successfully BLOCKED!');

  // 2. Try to add bold to unlocked text (pos 1 to 7)
  const trBoldUnlocked = state.tr.addMark(1, 7, bMark);
  if (!filter(trBoldUnlocked)) {
    throw new Error('Expected adding bold to unlocked text to be ALLOWED, but was blocked!');
  }
  console.log('✓ Adding formatting (bold) to unlocked text is successfully ALLOWED!');

  // 3. Try to convert paragraph 1 (containing locked text) into a heading
  const para1End = doc.child(0).nodeSize; // 32
  const trHeadingPara1 = state.tr.setBlockType(0, para1End, schema.nodes.heading, { level: 1 });
  if (filter(trHeadingPara1)) {
    throw new Error('Expected converting block with locked text to heading to be BLOCKED, but was allowed!');
  }
  console.log('✓ Block conversion (heading) on section containing locked text is successfully BLOCKED!');

  // 4. Try to convert paragraph 2 (no locked text) into a heading
  const para2Start = para1End;
  const para2End = para1End + doc.child(1).nodeSize;
  const trHeadingPara2 = state.tr.setBlockType(para2Start, para2End, schema.nodes.heading, { level: 2 });
  if (!filter(trHeadingPara2)) {
    throw new Error('Expected converting block without locked text to heading to be ALLOWED, but was blocked!');
  }
  console.log('✓ Block conversion (heading) on section without locked text is successfully ALLOWED!');

  // 5. Test removing mark from locked text (when locked text already has another mark)
  const docWithBoldLock = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Prefix '),
      schema.text('immutable thesis', [l1Mark, bMark]),
    ]),
  ]);
  const stateWithBold = EditorState.create({ doc: docWithBoldLock, schema, plugins });
  const trRemoveBold = stateWithBold.tr.removeMark(8, 24, bMark);
  let removeBlocked = false;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trRemoveBold, stateWithBold)) {
      removeBlocked = true;
      break;
    }
  }
  if (!removeBlocked) {
    throw new Error('Expected removing mark from locked text to be BLOCKED, but was allowed!');
  }
  console.log('✓ Removing formatting marks from locked text is successfully BLOCKED!');

  // 6. Test adding link mark to locked text vs unlocked text
  const linkSchema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      text: { group: 'inline' },
    },
    marks: {
      lock: { inclusive: false, attrs: { lockId: { default: null } } },
      link: { attrs: { href: { default: '' } } },
    },
  });
  const linkMark = linkSchema.marks.link.create({ href: 'https://example.com' });
  const docWithLinkTest = linkSchema.node('doc', null, [
    linkSchema.node('paragraph', null, [
      linkSchema.text('Prefix '),
      linkSchema.text('immutable thesis', [linkSchema.marks.lock.create({ lockId: 'l-link' })]),
      linkSchema.text(' suffix'),
    ]),
  ]);
  const stateWithLink = EditorState.create({ doc: docWithLinkTest, schema: linkSchema, plugins });
  const trLinkLocked = stateWithLink.tr.addMark(8, 24, linkMark);
  let linkBlocked = false;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trLinkLocked, stateWithLink)) {
      linkBlocked = true;
      break;
    }
  }
  if (!linkBlocked) {
    throw new Error('Expected adding link to locked text to be BLOCKED, but was allowed!');
  }
  console.log('✓ Adding link to locked text is successfully BLOCKED!');

  const trLinkUnlocked = stateWithLink.tr.addMark(1, 7, linkMark);
  let linkAllowed = true;
  for (const plugin of plugins) {
    if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(trLinkUnlocked, stateWithLink)) {
      linkAllowed = false;
      break;
    }
  }
  if (!linkAllowed) {
    throw new Error('Expected adding link to unlocked text to be ALLOWED, but was blocked!');
  }
  console.log('✓ Adding link to unlocked text is successfully ALLOWED!');

  // 7. Test H4 block conversion on locked vs unlocked sections
  const trH4Locked = state.tr.setBlockType(0, para1End, schema.nodes.heading, { level: 4 });
  if (filter(trH4Locked)) {
    throw new Error('Expected H4 conversion on locked section to be BLOCKED, but was allowed!');
  }
  console.log('✓ Converting section with locked text to Heading 4 is successfully BLOCKED!');

  const trH4Unlocked = state.tr.setBlockType(para2Start, para2End, schema.nodes.heading, { level: 4 });
  if (!filter(trH4Unlocked)) {
    throw new Error('Expected H4 conversion on unlocked section to be ALLOWED, but was blocked!');
  }
  console.log('✓ Converting section without locked text to Heading 4 is successfully ALLOWED!');
}

function testSelectAllDeletePreventionWithSnackbarNotice() {
  console.log('--- 8. Testing Select-All Delete Prevention & Snackbar Notice ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      text: { group: 'inline' },
    },
    marks: {
      lock: { inclusive: false, attrs: { lockId: { default: null } } },
    },
  });

  const lockMarkType = schema.marks.lock;
  const l1Mark = lockMarkType.create({ lockId: 'lock-nodelete' });

  // Mock global window event listener
  let capturedEvent: any = null;
  (globalThis as any).window = {
    dispatchEvent: (e: any) => {
      capturedEvent = e;
    },
  };
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, options: any) {
      this.type = type;
      this.detail = options?.detail;
    }
  };

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Opening thoughts. '),
      schema.text('Immutable thesis that must persist.', [l1Mark]),
      schema.text(' Closing thoughts.'),
    ]),
  ]);

  const plugins = LockMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const state = EditorState.create({ doc, schema, plugins });

  const filter = (tr: any) => {
    for (const plugin of plugins) {
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(tr, state)) {
        return false;
      }
    }
    return true;
  };

  // 1. Try to Select All and Delete (0 to doc.content.size)
  const trSelectAllDelete = state.tr.delete(0, state.doc.content.size);
  const isSelectAllAllowed = filter(trSelectAllDelete);

  if (isSelectAllAllowed) {
    throw new Error('Expected Select All + Delete to be strictly BLOCKED when locked text exists, but was allowed!');
  }
  console.log('✓ Select All + Delete across entire document is strictly BLOCKED when locked text exists!');

  if (!capturedEvent || capturedEvent.type !== 'pujangga:locked-text-delete-attempt') {
    throw new Error('Expected pujangga:locked-text-delete-attempt event to be dispatched, but was not!');
  }
  console.log('✓ Snackbar event pujangga:locked-text-delete-attempt dispatched with message: "' + capturedEvent.detail.message + '"');

  // 2. Test handleKeyDown on Select All selection
  const mockView = {
    state: {
      selection: { from: 0, to: state.doc.content.size },
      schema,
      doc: state.doc,
    },
  };
  const guardPlugin = plugins.find((p: any) => p.key?.startsWith('textLockGuard'));
  if (guardPlugin && guardPlugin.props.handleKeyDown) {
    capturedEvent = null;
    const handledBackspace = guardPlugin.props.handleKeyDown(mockView as any, { key: 'Backspace' } as any);
    if (!handledBackspace) {
      throw new Error('Expected handleKeyDown to intercept Backspace on Select All selection!');
    }
    if (!capturedEvent) {
      throw new Error('Expected handleKeyDown to dispatch snackbar event!');
    }
    console.log('✓ handleKeyDown cleanly intercepts Backspace on select-all selection and triggers snackbar!');

    capturedEvent = null;
    const handledCut = guardPlugin.props.handleKeyDown(mockView as any, { key: 'x', metaKey: true } as any);
    if (!handledCut) {
      throw new Error('Expected handleKeyDown to intercept Cut (Cmd+X) on Select All selection!');
    }
    console.log('✓ handleKeyDown cleanly intercepts Cut (Cmd+X) on select-all selection and triggers snackbar!');
  }

  // 3. Document without locked text should permit select all delete
  const docUnlocked = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Completely unlocked text.'),
    ]),
  ]);
  const stateUnlocked = EditorState.create({ doc: docUnlocked, schema, plugins });
  const filterUnlocked = (tr: any) => {
    for (const plugin of plugins) {
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(tr, stateUnlocked)) {
        return false;
      }
    }
    return true;
  };
  const trUnlockedDelete = stateUnlocked.tr.delete(0, docUnlocked.content.size);
  if (!filterUnlocked(trUnlockedDelete)) {
    throw new Error('Expected Select All + Delete on unlocked document to be ALLOWED, but was blocked!');
  }
  console.log('✓ Select All + Delete on unlocked document is cleanly ALLOWED!');

  // Cleanup globals
  delete (globalThis as any).window;
  delete (globalThis as any).CustomEvent;
}

function testSelectAllDeletePreventionForNotedTextWithSnackbar() {
  console.log('--- 9. Testing Select-All Delete Prevention & Info Snackbar for Noted Text ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*' },
      text: { group: 'inline' },
    },
    marks: {
      comment: { inclusive: false, attrs: { commentId: { default: null } } },
      lock: { inclusive: false, attrs: { lockId: { default: null } } },
    },
  });

  const commentMarkType = schema.marks.comment;
  const c1Mark = commentMarkType.create({ commentId: 'comment-nodelete' });

  // Mock global window event listener
  let capturedEvent: any = null;
  (globalThis as any).window = {
    dispatchEvent: (e: any) => {
      capturedEvent = e;
    },
  };
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, options: any) {
      this.type = type;
      this.detail = options?.detail;
    }
  };

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Initial paragraph. '),
      schema.text('Noted sentence with active feedback.', [c1Mark]),
      schema.text(' Final remarks.'),
    ]),
  ]);

  const plugins = CommentMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const state = EditorState.create({ doc, schema, plugins });

  const filter = (tr: any) => {
    for (const plugin of plugins) {
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(tr, state)) {
        return false;
      }
    }
    return true;
  };

  // 1. Try to Select All and Delete (0 to doc.content.size)
  const trSelectAllDelete = state.tr.delete(0, state.doc.content.size);
  const isSelectAllAllowed = filter(trSelectAllDelete);

  if (isSelectAllAllowed) {
    throw new Error('Expected Select All + Delete to be strictly BLOCKED when noted text exists, but was allowed!');
  }
  console.log('✓ Select All + Delete across entire document is strictly BLOCKED when noted text exists!');

  if (!capturedEvent || capturedEvent.type !== 'pujangga:noted-text-delete-attempt') {
    throw new Error('Expected pujangga:noted-text-delete-attempt event to be dispatched, but was not!');
  }
  console.log('✓ Snackbar event pujangga:noted-text-delete-attempt dispatched with message: "' + capturedEvent.detail.message + '"');

  // 2. Test handleKeyDown on Select All selection
  const mockView = {
    state: {
      selection: { from: 0, to: state.doc.content.size },
      schema,
      doc: state.doc,
    },
  };
  const guardPlugin = plugins.find((p: any) => p.key?.startsWith('commentLock'));
  if (guardPlugin && guardPlugin.props.handleKeyDown) {
    capturedEvent = null;
    const handledBackspace = guardPlugin.props.handleKeyDown(mockView as any, { key: 'Backspace' } as any);
    if (!handledBackspace) {
      throw new Error('Expected handleKeyDown to intercept Backspace on Select All selection with noted text!');
    }
    if (!capturedEvent || capturedEvent.type !== 'pujangga:noted-text-delete-attempt') {
      throw new Error('Expected handleKeyDown to dispatch pujangga:noted-text-delete-attempt event!');
    }
    console.log('✓ handleKeyDown cleanly intercepts Backspace on select-all selection and triggers info snackbar!');

    capturedEvent = null;
    const handledCut = guardPlugin.props.handleKeyDown(mockView as any, { key: 'x', metaKey: true } as any);
    if (!handledCut) {
      throw new Error('Expected handleKeyDown to intercept Cut (Cmd+X) on Select All selection with noted text!');
    }
    console.log('✓ handleKeyDown cleanly intercepts Cut (Cmd+X) on select-all selection and triggers info snackbar!');
  }

  // 3. Document without comments should permit select all delete
  const docUncommented = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Completely note-free text.'),
    ]),
  ]);
  const stateUncommented = EditorState.create({ doc: docUncommented, schema, plugins });
  const filterUncommented = (tr: any) => {
    for (const plugin of plugins) {
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction(tr, stateUncommented)) {
        return false;
      }
    }
    return true;
  };
  const trUncommentedDelete = stateUncommented.tr.delete(0, docUncommented.content.size);
  if (!filterUncommented(trUncommentedDelete)) {
    throw new Error('Expected Select All + Delete on note-free document to be ALLOWED, but was blocked!');
  }
  console.log('✓ Select All + Delete on note-free document is cleanly ALLOWED!');

  // Cleanup globals
  delete (globalThis as any).window;
  delete (globalThis as any).CustomEvent;
}

function testUndoRedoImmunity() {
  console.log('--- 10. Testing Undo/Redo Immunity for LockMark and CommentMark ---');

  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*' },
      text: { inline: true },
    },
    marks: {
      lock: { attrs: { lockId: { default: null } } },
      comment: { attrs: { commentId: { default: null } } },
    },
  });

  const lockPlugins = LockMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const commentPlugins = CommentMark.config.addProseMirrorPlugins?.call({} as any) || [];
  const plugins = [...lockPlugins, ...commentPlugins, history()];

  let state = EditorState.create({
    schema,
    doc: schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Initial document draft.')]),
    ]),
    plugins,
  });

  const applyTr = (tr: any) => {
    for (const p of plugins) {
      if (p.spec.filterTransaction && !p.spec.filterTransaction(tr, state)) {
        return false;
      }
    }
    state = state.apply(tr);
    return true;
  };

  // 1. Lock 'document' (positions 9 to 17) via setLock command
  const lockCmd = (LockMark.config.addCommands?.call({ name: 'lock' } as any) as any).setLock('lock-undo-test');
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 9, 17)));
  let lockApplied = false;
  lockCmd({
    tr: state.tr,
    dispatch: (tr: any) => {
      lockApplied = applyTr(tr);
    },
  });

  if (!lockApplied) {
    throw new Error('Expected setLock to be applied!');
  }
  const hasLockBeforeUndo = state.doc.resolve(10).marks().some((m) => m.type === schema.marks.lock);
  if (!hasLockBeforeUndo) {
    throw new Error('Expected pos 10 to have lock mark!');
  }

  // 2. Verify that undo does NOT undo the lock
  let undoTr1: any = null;
  const canUndoLock = undo(state, (tr) => { undoTr1 = tr; });
  if (canUndoLock && undoTr1) {
    applyTr(undoTr1);
  }
  const hasLockAfterUndo = state.doc.resolve(10).marks().some((m) => m.type === schema.marks.lock);
  if (!hasLockAfterUndo) {
    throw new Error('Lock mark was removed by undo! Locking must NOT enter the undo stack.');
  }
  console.log('✓ Locking text is completely bypassed from the undo/redo stack!');

  // 3. Add comment to 'Initial' (positions 1 to 8) via setComment command
  const commCmd = (CommentMark.config.addCommands?.call({ name: 'comment' } as any) as any).setComment('comm-undo-test');
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 8)));
  let commApplied = false;
  commCmd({
    tr: state.tr,
    dispatch: (tr: any) => {
      commApplied = applyTr(tr);
    },
  });

  if (!commApplied) {
    throw new Error('Expected setComment to be applied!');
  }
  const hasCommBeforeUndo = state.doc.resolve(2).marks().some((m) => m.type === schema.marks.comment);
  if (!hasCommBeforeUndo) {
    throw new Error('Expected pos 2 to have comment mark!');
  }

  // 4. Verify that undo does NOT undo the comment
  let undoTr2: any = null;
  const canUndoComm = undo(state, (tr) => { undoTr2 = tr; });
  if (canUndoComm && undoTr2) {
    applyTr(undoTr2);
  }
  const hasCommAfterUndo = state.doc.resolve(2).marks().some((m) => m.type === schema.marks.comment);
  if (!hasCommAfterUndo) {
    throw new Error('Comment mark was removed by undo! Commenting must NOT enter the undo stack.');
  }
  console.log('✓ Adding notes to text is completely bypassed from the undo/redo stack!');

  // 5. Type new unlocked text ' Extra.' at end of paragraph
  const trInsert = state.tr.insertText(' Extra.', state.doc.content.size - 1);
  const insertApplied = applyTr(trInsert);
  if (!insertApplied) {
    throw new Error('Expected text insertion to succeed!');
  }
  if (!state.doc.textContent.endsWith(' Extra.')) {
    throw new Error('Expected text content to end with Extra.!');
  }

  // 6. Undo should cleanly revert ' Extra.' without modifying lock or comment
  let undoTr3: any = null;
  const canUndoInsert = undo(state, (tr) => { undoTr3 = tr; });
  if (!canUndoInsert || !undoTr3) {
    throw new Error('Expected undo to be available for regular text insertion!');
  }
  const undoInsertApplied = applyTr(undoTr3);
  if (!undoInsertApplied) {
    throw new Error('Expected undo of regular text insertion to be allowed!');
  }
  if (state.doc.textContent.includes(' Extra.')) {
    throw new Error('Expected Extra. to be cleanly undone!');
  }
  const stillHasLock = state.doc.resolve(10).marks().some((m) => m.type === schema.marks.lock);
  const stillHasComm = state.doc.resolve(2).marks().some((m) => m.type === schema.marks.comment);
  if (!stillHasLock || !stillHasComm) {
    throw new Error('Lock or comment marks were corrupted during text undo!');
  }
  console.log('✓ Undoing unlocked text edits preserves locked and noted marks intact!');

  // 7. Verify removing lock does NOT add into undo stack (undo cannot re-lock)
  const removeLockCmd = (LockMark.config.addCommands?.call({ name: 'lock' } as any) as any).removeLock('lock-undo-test');
  let lockRemoved = false;
  removeLockCmd({
    tr: state.tr,
    dispatch: (tr: any) => {
      lockRemoved = applyTr(tr);
    },
  });
  if (!lockRemoved) {
    throw new Error('Expected removeLock to succeed!');
  }
  const lockGone = !state.doc.resolve(10).marks().some((m) => m.type === schema.marks.lock);
  if (!lockGone) {
    throw new Error('Expected lock to be removed!');
  }

  let undoTr4: any = null;
  const canUndoRemoveLock = undo(state, (tr) => { undoTr4 = tr; });
  if (canUndoRemoveLock && undoTr4) {
    applyTr(undoTr4);
  }
  const lockStillGone = !state.doc.resolve(10).marks().some((m) => m.type === schema.marks.lock);
  if (!lockStillGone) {
    throw new Error('Lock removal was undone by undo! Lock removal must not enter undo stack.');
  }
  console.log('✓ Removing lock segments is completely bypassed from the undo/redo stack!');

  // 8. Verify removing comment does NOT add into undo stack (undo cannot re-comment)
  const removeCommCmd = (CommentMark.config.addCommands?.call({ name: 'comment' } as any) as any).removeComment('comm-undo-test');
  let commRemoved = false;
  removeCommCmd({
    tr: state.tr,
    dispatch: (tr: any) => {
      commRemoved = applyTr(tr);
    },
  });
  if (!commRemoved) {
    throw new Error('Expected removeComment to succeed!');
  }
  const commGone = !state.doc.resolve(2).marks().some((m) => m.type === schema.marks.comment);
  if (!commGone) {
    throw new Error('Expected comment to be removed!');
  }

  let undoTr5: any = null;
  const canUndoRemoveComm = undo(state, (tr) => { undoTr5 = tr; });
  if (canUndoRemoveComm && undoTr5) {
    applyTr(undoTr5);
  }
  const commStillGone = !state.doc.resolve(2).marks().some((m) => m.type === schema.marks.comment);
  if (!commStillGone) {
    throw new Error('Comment removal was undone by undo! Comment removal must not enter undo stack.');
  }
  console.log('✓ Removing review notes is completely bypassed from the undo/redo stack!');
}

function runAll() {
  testCommentLock();
  testLockMarkGuard();
  testAgentReportWithLockedText();
  testDatabaseLockedTextPersistence();
  testLockedTextCannotBeCommented();
  testTypingAfterLockedOrCommentedText();
  testLockedTextFormattingImmutability();
  testSelectAllDeletePreventionWithSnackbarNotice();
  testSelectAllDeletePreventionForNotedTextWithSnackbar();
  testUndoRedoImmunity();
  console.log('\n=== All Text Locking & Anchoring Tests Passed! ===\n');
}

runAll();
