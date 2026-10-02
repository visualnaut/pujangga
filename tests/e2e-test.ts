import fs from 'node:fs';
import path from 'node:path';
import { ensureDaemonRunning, getDaemonStatus, stopDaemon } from '../src/daemon/manager.js';
import { DatabaseService } from '../src/daemon/db.js';

async function runE2ETest() {
  console.log('--- Starting Pujangga E2E Test ---');

  const testFile = path.resolve(`sample-test-${Date.now()}.md`);
  fs.writeFileSync(testFile, '# Test Document\n\nThis is paragraph one.\n\nThis is paragraph two.\n', 'utf8');

  // 1. Ensure daemon starts
  console.log('1. Booting daemon...');
  const port = await ensureDaemonRunning();
  console.log(`✓ Daemon online on port ${port}`);

  // 2. Register review session
  console.log('2. Registering review session...');
  const registerRes = await fetch(`http://localhost:${port}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: testFile,
      workspaceDir: process.cwd(),
      contentMarkdown: fs.readFileSync(testFile, 'utf8'),
    }),
  });

  const sessionData = await registerRes.json();
  console.log(`✓ Session registered: ${sessionData.sessionId}, Round: ${sessionData.roundNumber}`);

  // 3. Verify session details
  const detailsRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}`);
  const details = await detailsRes.json();
  if (details.currentRevision.roundNumber !== 1) {
    throw new Error('Expected round 1');
  }
  console.log(`✓ Session details loaded: "${details.session.title}"`);

  // 3b. Verify that submitting NEEDS_REVISION without notes or directive is rejected
  console.log('2b. Testing revision request rejection when no notes or directive provided...');
  const invalidSubmitRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEditedMarkdown: '# Test Document\n\nContent',
      overallComment: '   ',
      status: 'NEEDS_REVISION',
      inlineComments: [],
    }),
  });
  if (invalidSubmitRes.status !== 400) {
    throw new Error(`Expected 400 status when submitting without notes or directive, got ${invalidSubmitRes.status}`);
  }
  const invalidData = await invalidSubmitRes.json();
  if (!invalidData.error?.includes('Unable to request revision without any new notes or directive')) {
    throw new Error(`Unexpected error message: ${JSON.stringify(invalidData)}`);
  }
  console.log(`✓ Revision request safely blocked when missing both notes and directive!`);

  // 4. Submit review for Round 1 with direct edits, inline comments, and locked text
  console.log('3. Locking text segment & submitting Round 1 review...');
  const lockRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/locked-texts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'This is paragraph one, directly polished by editor.',
    }),
  });
  const lockData = await lockRes.json();
  console.log(`✓ Text segment locked: "${lockData.text}" (id: ${lockData.id})`);

  const editedText = '# Test Document\n\nThis is paragraph one, directly polished by editor.\n\nThis is paragraph two.\n';
  const submitRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEditedMarkdown: editedText,
      overallComment: 'Make the conclusion stronger in paragraph two.',
      status: 'NEEDS_REVISION',
      inlineComments: [
        {
          anchorText: 'paragraph two',
          commentText: 'Add latency benchmarks here.',
        },
      ],
      lockedTexts: [
        {
          id: lockData.id,
          text: lockData.text,
        },
      ],
    }),
  });

  const submitData = await submitRes.json();
  console.log(`✓ Round 1 submitted:`, submitData);

  // 4b. Verify /wait endpoint returns lockedTexts and agent report includes locked directive
  const waitRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/wait`);
  const waitData = await waitRes.json();
  if (!waitData.reportMarkdown.includes('## 🔒 Locked Text Segments (CRITICAL: DO NOT MODIFY)')) {
    throw new Error('Expected agent report to include Locked Text Segments header!');
  }
  if (!waitData.lockedTexts || waitData.lockedTexts.length !== 1) {
    throw new Error('Expected 1 lockedText in wait response');
  }
  console.log(`✓ Agent report and wait response properly include locked text immutability directive!`);

  // 5. Verify file on disk was updated with direct edits
  const onDiskContent = fs.readFileSync(testFile, 'utf8');
  if (!onDiskContent.includes('directly polished by editor')) {
    throw new Error(`File on disk was not updated with direct edits! Content: ${onDiskContent}`);
  }
  console.log(`✓ Target file on disk successfully updated with editor edits!`);

  // 6. Agent performs revision and submits Round 2
  console.log('4. Agent registers Round 2 revision...');
  const revisedByAgent = '# Test Document\n\nThis is paragraph one, directly polished by editor.\n\nThis is paragraph two with latency benchmarks (45ms response time).\n';
  fs.writeFileSync(testFile, revisedByAgent, 'utf8');

  const round2Res = await fetch(`http://localhost:${port}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: testFile,
      workspaceDir: process.cwd(),
      contentMarkdown: revisedByAgent,
    }),
  });
  const round2Data = await round2Res.json();
  if (round2Data.roundNumber !== 2) {
    throw new Error(`Expected round 2, got ${round2Data.roundNumber}`);
  }
  console.log(`✓ Round 2 successfully registered!`);

  // 7. Verify previous comment is marked resolved and locked text persisted into Round 2!
  const details2Res = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}`);
  const details2 = await details2Res.json();
  const prevComment = details2.comments.find((c: any) => c.anchorText === 'paragraph two');
  console.log(`✓ Previous round comment status: ${prevComment?.status} (resolved at round ${prevComment?.resolvedAtRound})`);

  if (!details2.lockedTexts || details2.lockedTexts.length !== 1 || details2.lockedTexts[0].id !== lockData.id) {
    throw new Error('Expected locked text to persist into Round 2 details!');
  }
  console.log(`✓ Locked text verified to persist across rounds into Round 2!`);

  // 8. Human approves as SATISFIED
  console.log('5. Submitting approval (SATISFIED)...');
  const approveRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEditedMarkdown: revisedByAgent,
      overallComment: 'Looks fantastic, approved!',
      status: 'SATISFIED',
      inlineComments: [],
    }),
  });
  await approveRes.json();
  console.log(`✓ Review session marked as SATISFIED!`);

  // Verify comments, older revisions, and locked texts are cleared upon SATISFIED
  const detailsAfterApproveRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}`);
  const detailsAfterApprove = await detailsAfterApproveRes.json();
  if (detailsAfterApprove.comments.length !== 0) {
    throw new Error(`Expected comments to be cleared upon SATISFIED, found: ${detailsAfterApprove.comments.length}`);
  }
  if (detailsAfterApprove.revisions.length !== 1) {
    throw new Error(`Expected older revisions to be cleared upon SATISFIED, found: ${detailsAfterApprove.revisions.length}`);
  }
  if (detailsAfterApprove.lockedTexts && detailsAfterApprove.lockedTexts.length !== 0) {
    throw new Error(`Expected locked texts to be cleared upon SATISFIED, found: ${detailsAfterApprove.lockedTexts.length}`);
  }
  console.log(`✓ Comments, locked texts, and historical revisions successfully cleared upon satisfaction!`);

  // Verify next review on this file starts completely fresh at Round 1
  const freshRegisterRes = await fetch(`http://localhost:${port}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: testFile,
      workspaceDir: process.cwd(),
      contentMarkdown: '# Fresh Document\n\nFresh review cycle.\n',
    }),
  });
  const freshRegisterData = await freshRegisterRes.json();
  if (freshRegisterData.roundNumber !== 1) {
    throw new Error(`Expected fresh review to start at round 1, got ${freshRegisterData.roundNumber}`);
  }
  console.log(`✓ Re-registering satisfied session started fresh at Round 1!`);

  // 9. Check status
  const finalStatus = await getDaemonStatus();
  console.log(`✓ Daemon status verified: running=${finalStatus.running}, active sessions=${finalStatus.details?.sessions.length}`);

  // 10. Stop daemon
  console.log('6. Stopping daemon...');
  await stopDaemon();
  console.log(`✓ Daemon stopped cleanly.`);

  // Cleanup sample file
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }

  console.log('=== All E2E Tests Passed Successfully! ===');
}

runE2ETest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
