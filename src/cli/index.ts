import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { ensureDaemonRunning, getDaemonStatus, stopDaemon } from '../daemon/manager.js';
import { RegisterSessionResponse, WaitReviewResponse } from '../shared/types.js';

export function openBrowser(url: string) {
  const platform = process.platform;
  let cmd = `open "${url}"`;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'linux') {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {});
}

async function handleReview(file: string, options: { open?: boolean }) {
  const resolvedPath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[Pujangga Error] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const contentMarkdown = fs.readFileSync(resolvedPath, 'utf8');
  const workspaceDir = process.cwd();

  try {
    const port = await ensureDaemonRunning();

    // 1. Register session with daemon
    const registerRes = await fetch(`http://localhost:${port}/api/sessions/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: resolvedPath,
        workspaceDir,
        contentMarkdown,
      }),
    });

    if (!registerRes.ok) {
      throw new Error(`Failed to register review session: ${registerRes.statusText}`);
    }

    const sessionData = (await registerRes.json()) as RegisterSessionResponse;

    // Auto-open browser if it's round 1 or explicitly requested
    if (options.open !== false && sessionData.isNewRound && sessionData.roundNumber === 1) {
      openBrowser(sessionData.url);
    }

    // Inform user on stderr so stdout remains dedicated for agent report
    console.error(`[Pujangga] Review surface active: ${sessionData.url}`);
    console.error(`[Pujangga] Round ${sessionData.roundNumber} waiting for review in browser... (Press Ctrl+C to pause)`);

    // Handle Ctrl+C cleanly
    let aborted = false;
    const abortController = new AbortController();

    process.on('SIGINT', () => {
      aborted = true;
      abortController.abort();
      console.error(`\n[Pujangga] Review paused. State preserved. Run 'pujangga "${file}"' anytime to resume.`);
      process.exit(0);
    });

    // 2. Block until review submission
    const waitRes = await fetch(`http://localhost:${port}/api/sessions/${sessionData.sessionId}/wait`, {
      signal: abortController.signal,
    });

    if (!waitRes.ok) {
      if (aborted) return;
      throw new Error(`Wait request failed with status: ${waitRes.status}`);
    }

    const waitData = (await waitRes.json()) as WaitReviewResponse;

    // 3. Print the Agent-optimized Markdown report to stdout
    process.stdout.write(waitData.reportMarkdown + '\n');
    process.exit(0);
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error(`[Pujangga Error]`, err.message || err);
    process.exit(1);
  }
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('pujangga')
    .description('Editorial writing review surface for AI agents and human editors')
    .version('1.0.0')
    .argument('[file]', 'Draft markdown file to review')
    .option('--no-open', 'Do not automatically open the browser')
    .action(async (file?: string, options?: { open?: boolean }) => {
      if (file) {
        await handleReview(file, options || {});
      } else {
        program.help();
      }
    });

  // Explicit 'review' subcommand (alias)
  program
    .command('review <file>')
    .description('Submit or resume a document review in the Pujangga web interface')
    .option('--no-open', 'Do not automatically open the browser')
    .action(handleReview);

  // Command: status
  program
    .command('status')
    .description('Check daemon health and active review sessions')
    .action(async () => {
      const status = await getDaemonStatus();
      if (!status.running) {
        console.log('Pujangga daemon is currently stopped.');
        return;
      }

      console.log(`Pujangga Daemon: RUNNING`);
      console.log(`Port: ${status.port}`);
      console.log(`PID: ${status.pid}`);
      console.log(`Uptime: ${status.details?.uptimeSeconds || 0}s`);

      const sessions = status.details?.sessions || [];
      if (sessions.length > 0) {
        console.log(`\nActive Review Sessions (${sessions.length}):`);
        for (const s of sessions) {
          console.log(` - [${s.status.toUpperCase()}] ${s.title} (${s.roundsCount} rounds)`);
          console.log(`   File: ${s.filePath}`);
          console.log(`   URL:  http://localhost:${status.port}/review/${s.id}`);
        }
      } else {
        console.log('\nNo active review sessions.');
      }
    });

  // Command: stop
  program
    .command('stop')
    .description('Stop the Pujangga background daemon')
    .action(async () => {
      const stopped = await stopDaemon();
      if (stopped) {
        console.log('Pujangga daemon stopped.');
      } else {
        console.log('Pujangga daemon was not running.');
      }
    });

  return program;
}
