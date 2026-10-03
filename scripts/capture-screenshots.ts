import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDaemonRunning, stopDaemon } from '../src/daemon/manager.js';

async function main() {
  console.log('🚀 Starting screenshot capture automation...');

  const tempFilePath = path.resolve('sample-craft-of-writing.md');
  const markdownContent = `# The Craft of Literary Coding: Building Thoughtful Interfaces for AI

> *"Literature is the art of discovering something extraordinary about ordinary people, and saying with ordinary words something extraordinary."* — Boris Pasternak

When human writers and autonomous code agents collaborate, the bottleneck is rarely generative capacity. Modern language models can draft thousands of words in seconds. Instead, the true bottleneck is **editorial bandwidth**: the human ability to digest, evaluate, critique, and shape generative output without cognitive fatigue.

## The Architecture of Human-in-the-Loop Review

Traditional code review surfaces prioritize line diffs and deterministic syntax trees. But prose is non-deterministic. A single phrase carries cadence, intent, voice, and subtext that syntax highlighting cannot parse.

Through literature, we examine the architecture of human resilience and discover principles for designing intelligent surfaces.

### Essential Principles for Agent Surfaces

1. **Contextual Anchoring:** Inline critiques must stay anchored to target phrases, surviving across revision cycles.
2. **Intent Preservation:** Approved prose must remain immutable, protected from autonomous hallucination or inadvertent truncation.
3. **Low-Friction Polish:** Reviewers must be empowered to tweak wording directly in-place without copy-pasting back and forth.

When these principles converge, the machine ceases to be a noisy replacement and becomes what it was always meant to be: an indefatigable apprentice to human thought.
`;

  fs.writeFileSync(tempFilePath, markdownContent, 'utf8');

  // 1. Ensure daemon is up
  const port = await ensureDaemonRunning();
  console.log(`✓ Daemon online on port ${port}`);

  // 2. Register session
  const regRes = await fetch(`http://localhost:${port}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: tempFilePath,
      workspaceDir: process.cwd(),
      contentMarkdown: markdownContent,
    }),
  });
  const sessionData = await regRes.json();
  const sessionId = sessionData.sessionId;
  console.log(`✓ Review session registered: ${sessionId}`);

  // 3. Add locked text
  const lockSentence = 'Through literature, we examine the architecture of human resilience and discover principles for designing intelligent surfaces.';
  await fetch(`http://localhost:${port}/api/sessions/${sessionId}/locked-texts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: lockSentence,
      sectionHeading: 'The Architecture of Human-in-the-Loop Review',
    }),
  });
  console.log(`✓ Locked text added: "${lockSentence.slice(0, 40)}..."`);

  // 4. Add inline comment
  await fetch(`http://localhost:${port}/api/sessions/${sessionId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anchorText: 'editorial bandwidth',
      commentText: 'Highlight how inline pins reduce cognitive overhead compared to chat threads.',
    }),
  });
  console.log('✓ Inline comment pinned');

  // 5. Launch Playwright Chromium
  console.log('🌐 Launching headless Chromium browser...');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 2, // Crisp Retina screenshots
    colorScheme: 'light',
  });

  const page = await context.newPage();
  const reviewUrl = `http://localhost:${port}/review/${sessionId}`;
  console.log(`🔗 Navigating to ${reviewUrl}...`);
  await page.goto(reviewUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot 1: Editorial Review Canvas
  const screenshot1Path = path.resolve('public/screenshot-review.png');
  await page.screenshot({ path: screenshot1Path });
  console.log(`📸 Saved Review Canvas screenshot to ${screenshot1Path}`);

  // Screenshot 2: Ananta Toer Mode
  console.log('🧘 Activating Ananta Toer Mode...');
  const zenButton = page.locator('button[title*="Ananta Toer Mode"]').first();
  await zenButton.click();
  await page.waitForTimeout(1200);

  const screenshot2Path = path.resolve('public/screenshot-focus.png');
  await page.screenshot({ path: screenshot2Path });
  console.log(`📸 Saved Ananta Toer Mode screenshot to ${screenshot2Path}`);

  // Exit Ananta Toer Mode using Escape key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // Submit Round 1 review to enable Revision Diff
  console.log('🔄 Submitting Round 1 review and pushing Round 2 revision...');
  await fetch(`http://localhost:${port}/api/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEditedMarkdown: markdownContent.replace(
        'Traditional code review surfaces prioritize line diffs',
        'Traditional developer tools prioritize rigid line diffs'
      ),
      overallComment: 'Refine section headings and expand on contextual anchoring.',
      status: 'NEEDS_REVISION',
    }),
  });

  // Push Round 2
  const round2Markdown = markdownContent
    .replace('Modern language models can draft thousands of words in seconds.', 'Modern language models generate thousands of prose drafts in mere seconds.')
    .replace('Traditional code review surfaces prioritize line diffs and deterministic syntax trees.', 'Traditional developer tools prioritize rigid line diffs and deterministic syntax trees.')
    .replace('### Essential Principles for Agent Surfaces', '### Core Tenets for Agent Editorial Surfaces');

  await fetch(`http://localhost:${port}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: tempFilePath,
      workspaceDir: process.cwd(),
      contentMarkdown: round2Markdown,
    }),
  });

  // Reload page to reflect Round 2
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot 3: Revision Diff Viewer
  console.log('🔍 Opening Revision Diff Viewer...');
  const diffButton = page.locator('button:has-text("Side-by-Side Diff")').first();
  if (await diffButton.isVisible()) {
    await diffButton.click();
    await page.waitForTimeout(1200);
    const screenshot3Path = path.resolve('public/screenshot-diff.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`📸 Saved Revision Diff screenshot to ${screenshot3Path}`);
    // Close diff viewer
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // Screenshot 4: Dark / Night Mode Canvas
  console.log('🌙 Capturing Dark Mode Canvas...');
  const themeToggle = page.locator('button[aria-label="Toggle theme"]').first();
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
    await page.waitForTimeout(800);
    const screenshot4Path = path.resolve('public/screenshot-dark.png');
    await page.screenshot({ path: screenshot4Path });
    console.log(`📸 Saved Dark Mode screenshot to ${screenshot4Path}`);
  }

  // Cleanup
  await browser.close();
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }
  await stopDaemon();
  console.log('✨ All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
