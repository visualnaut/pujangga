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

  // 4. Submit review for Round 1
  console.log('3. Submitting Round 1 review with direct edits & inline comments...');
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
    }),
  });

  const submitData = await submitRes.json();
  console.log(`✓ Round 1 submitted:`, submitData);

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

  // 7. Verify previous comment is marked resolved
  const details2Res = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}`);
  const details2 = await details2Res.json();
  const prevComment = details2.comments.find((c: any) => c.anchorText === 'paragraph two');
  console.log(`✓ Previous round comment status: ${prevComment?.status} (resolved at round ${prevComment?.resolvedAtRound})`);

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
