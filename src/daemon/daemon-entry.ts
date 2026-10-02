import fs from 'node:fs';
import path from 'node:path';
import { PujanggaServer } from './server.js';
import { getPujanggaDir } from './db.js';
import { DaemonInfo } from '../shared/types.js';

const daemonJsonPath = path.join(getPujanggaDir(), 'daemon.json');

async function main() {
  const port = process.env.PUJANGGA_PORT ? parseInt(process.env.PUJANGGA_PORT, 10) : 4173;
  const server = new PujanggaServer({ port });

  const activePort = await server.start();
  console.log(`[Pujangga Daemon] Running on port ${activePort} (PID: ${process.pid})`);

  const info: DaemonInfo = {
    pid: process.pid,
    port: activePort,
    startedAt: Date.now(),
  };

  fs.writeFileSync(daemonJsonPath, JSON.stringify(info, null, 2), 'utf8');

  const cleanup = () => {
    try {
      if (fs.existsSync(daemonJsonPath)) {
        fs.unlinkSync(daemonJsonPath);
      }
    } catch {
      // ignore
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', async () => {
    cleanup();
    await server.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    cleanup();
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Pujangga Daemon] Fatal error:', err);
  process.exit(1);
});
