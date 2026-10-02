import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPujanggaDir } from './db.js';
import { DaemonInfo } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDaemonJsonPath(): string {
  return path.join(getPujanggaDir(), 'daemon.json');
}

export async function pingDaemon(port: number): Promise<any | null> {
  try {
    const res = await fetch(`http://localhost:${port}/api/status`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // not running
  }
  return null;
}

export async function getDaemonStatus(): Promise<{
  running: boolean;
  port?: number;
  pid?: number;
  details?: any;
}> {
  const jsonPath = getDaemonJsonPath();
  if (!fs.existsSync(jsonPath)) {
    return { running: false };
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const info = JSON.parse(content) as DaemonInfo;
    const status = await pingDaemon(info.port);

    if (status) {
      return {
        running: true,
        port: info.port,
        pid: info.pid,
        details: status,
      };
    } else {
      // Stale daemon.json file
      try {
        fs.unlinkSync(jsonPath);
      } catch {
        // ignore
      }
      return { running: false };
    }
  } catch {
    return { running: false };
  }
}

export async function ensureDaemonRunning(): Promise<number> {
  const current = await getDaemonStatus();
  if (current.running && current.port) {
    return current.port;
  }

  // Find daemon entry script
  // In development, tsx runs daemon-entry.ts. In production, node runs dist/daemon/daemon-entry.js
  const tsEntry = path.resolve(__dirname, 'daemon-entry.ts');
  const jsEntry = path.resolve(__dirname, 'daemon-entry.js');

  const runner = fs.existsSync(tsEntry) ? 'tsx' : 'node';
  const entryScript = fs.existsSync(tsEntry) ? tsEntry : jsEntry;

  const child = spawn(runner, [entryScript], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PUJANGGA_PORT: process.env.PUJANGGA_PORT || '4173',
    },
  });

  child.unref();

  // Wait for daemon to become ready
  const defaultPort = parseInt(process.env.PUJANGGA_PORT || '4173', 10);
  const startTime = Date.now();
  const timeoutMs = 8000;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200));
    const status = await getDaemonStatus();
    if (status.running && status.port) {
      return status.port;
    }
  }

  throw new Error('Timed out waiting for Pujangga background daemon to start.');
}

export async function stopDaemon(): Promise<boolean> {
  const status = await getDaemonStatus();
  if (!status.running || !status.port) {
    return false;
  }

  try {
    await fetch(`http://localhost:${status.port}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // If HTTP shutdown failed, try killing the process directly
    if (status.pid) {
      try {
        process.kill(status.pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
  }

  const jsonPath = getDaemonJsonPath();
  if (fs.existsSync(jsonPath)) {
    try {
      fs.unlinkSync(jsonPath);
    } catch {
      // ignore
    }
  }

  return true;
}
