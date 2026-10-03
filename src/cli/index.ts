import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureDaemonRunning, getDaemonStatus, stopDaemon } from '../daemon/manager.js';
import { getDatabasePath, resetDatabaseFiles } from '../daemon/db.js';
import { RegisterSessionResponse, WaitReviewResponse } from '../shared/types.js';

export function openBrowser(url: string) {
  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd.exe';
    args = ['/c', 'start', '""', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch (err: any) {
    console.error(`[Pujangga] Note: Could not auto-open browser: ${err?.message || err}`);
  }
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

    // Auto-open browser unless explicitly disabled with --no-open.
    // Opens if no browser tab is currently connected, or if it's round 1.
    if (options.open !== false) {
      if (!sessionData.hasConnectedClients || sessionData.roundNumber === 1) {
        openBrowser(sessionData.url);
      }
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

    // 2. Block until review submission (use node:http to avoid undici 5-min timeout)
    const waitData = await new Promise<WaitReviewResponse>((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}/api/sessions/${sessionData.sessionId}/wait`,
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Wait request failed with status: ${res.statusCode}`));
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.setTimeout(0);

      req.on('error', (err) => {
        if (aborted) return;
        reject(err);
      });

      abortController.signal.addEventListener('abort', () => {
        req.destroy();
      });
    });

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

  // Command: reset
  program
    .command('reset')
    .description('Reset the entire Pujangga database and session history')
    .option('-y, --yes', 'Skip confirmation prompt and proceed immediately')
    .action(async (options: { yes?: boolean }) => {
      const dbPath = getDatabasePath();
      const status = await getDaemonStatus();

      if (!options.yes) {
        console.log(`\n========================================`);
        console.log(`       PUJANGGA DATABASE RESET           `);
        console.log(`========================================\n`);
        console.log(`This operation will permanently erase all Pujangga data:`);
        console.log(`  • Database location: ${dbPath}`);
        console.log(`  • What will be deleted:`);
        console.log(`    - All active and historical review sessions`);
        console.log(`    - All revision drafts and round comparisons`);
        console.log(`    - All inline comment pins and history`);
        console.log(`    - All locked text segments and anchor mappings`);
        if (status.running) {
          console.log(`  • Daemon status: Currently RUNNING (PID ${status.pid}, Port ${status.port})`);
          console.log(`    - The daemon will be stopped before wiping database files.`);
        }
        console.log(`\n⚠️  WARNING: This action is destructive and CANNOT be undone.\n`);

        const rl = readline.createInterface({ input, output });
        try {
          const answer = await rl.question('Are you sure you want to reset the database? [y/N]: ');
          const confirmed = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
          if (!confirmed) {
            console.log('\nReset cancelled. No data was modified.\n');
            return;
          }
        } finally {
          rl.close();
        }
      }

      console.log('\nProceeding with database reset...');

      if (status.running) {
        await stopDaemon();
        console.log('✓ Background daemon stopped.');
      }

      const result = resetDatabaseFiles();
      if (result.filesRemoved.length > 0) {
        console.log(`✓ Removed database file(s): ${result.filesRemoved.join(', ')}`);
      } else {
        console.log('✓ Database was already clean or file did not exist.');
      }

      console.log('✓ Pujangga database reset complete. Fresh database will be created on next review.\n');
    });

  return program;
}
