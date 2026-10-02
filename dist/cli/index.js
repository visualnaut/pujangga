// src/cli/index.ts
import { Command } from "commander";
import fs3 from "fs";
import path3 from "path";
import http from "http";
import { spawn as spawn2 } from "child_process";

// src/daemon/manager.ts
import fs2 from "fs";
import path2 from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// src/daemon/db.ts
import nodeModule from "module";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
var require2 = nodeModule.createRequire(import.meta.url);
var { DatabaseSync } = require2("node:sqlite");
function getPujanggaDir() {
  const dir = path.join(os.homedir(), ".pujangga");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// src/daemon/manager.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function getDaemonJsonPath() {
  return path2.join(getPujanggaDir(), "daemon.json");
}
async function pingDaemon(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/status`, {
      signal: AbortSignal.timeout(1e3)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
  }
  return null;
}
async function getDaemonStatus() {
  const jsonPath = getDaemonJsonPath();
  if (!fs2.existsSync(jsonPath)) {
    return { running: false };
  }
  try {
    const content = fs2.readFileSync(jsonPath, "utf8");
    const info = JSON.parse(content);
    const status = await pingDaemon(info.port);
    if (status) {
      return {
        running: true,
        port: info.port,
        pid: info.pid,
        details: status
      };
    } else {
      try {
        fs2.unlinkSync(jsonPath);
      } catch {
      }
      return { running: false };
    }
  } catch {
    return { running: false };
  }
}
async function ensureDaemonRunning() {
  const current = await getDaemonStatus();
  if (current.running && current.port) {
    return current.port;
  }
  const candidateScripts = [
    path2.resolve(__dirname, "../daemon/daemon-entry.js"),
    path2.resolve(__dirname, "daemon-entry.js"),
    path2.resolve(__dirname, "../daemon/daemon-entry.ts"),
    path2.resolve(__dirname, "daemon-entry.ts")
  ];
  const entryScript = candidateScripts.find((p) => fs2.existsSync(p));
  if (!entryScript) {
    throw new Error("Could not locate Pujangga daemon entry script.");
  }
  const runner = entryScript.endsWith(".ts") ? "tsx" : "node";
  const child = spawn(runner, [entryScript], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PUJANGGA_PORT: process.env.PUJANGGA_PORT || "4173"
    }
  });
  child.unref();
  const defaultPort = parseInt(process.env.PUJANGGA_PORT || "4173", 10);
  const startTime = Date.now();
  const timeoutMs = 8e3;
  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200));
    const status = await getDaemonStatus();
    if (status.running && status.port) {
      return status.port;
    }
  }
  throw new Error("Timed out waiting for Pujangga background daemon to start.");
}
async function stopDaemon() {
  const status = await getDaemonStatus();
  if (!status.running || !status.port) {
    return false;
  }
  try {
    await fetch(`http://localhost:${status.port}/api/shutdown`, {
      method: "POST",
      signal: AbortSignal.timeout(2e3)
    });
  } catch {
    if (status.pid) {
      try {
        process.kill(status.pid, "SIGTERM");
      } catch {
      }
    }
  }
  const jsonPath = getDaemonJsonPath();
  if (fs2.existsSync(jsonPath)) {
    try {
      fs2.unlinkSync(jsonPath);
    } catch {
    }
  }
  return true;
}

// src/cli/index.ts
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  let args;
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "start", '""', url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn2(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
  } catch (err) {
    console.error(`[Pujangga] Note: Could not auto-open browser: ${err?.message || err}`);
  }
}
async function handleReview(file, options) {
  const resolvedPath = path3.resolve(process.cwd(), file);
  if (!fs3.existsSync(resolvedPath)) {
    console.error(`[Pujangga Error] File not found: ${resolvedPath}`);
    process.exit(1);
  }
  const contentMarkdown = fs3.readFileSync(resolvedPath, "utf8");
  const workspaceDir = process.cwd();
  try {
    const port = await ensureDaemonRunning();
    const registerRes = await fetch(`http://localhost:${port}/api/sessions/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: resolvedPath,
        workspaceDir,
        contentMarkdown
      })
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register review session: ${registerRes.statusText}`);
    }
    const sessionData = await registerRes.json();
    if (options.open !== false) {
      if (!sessionData.hasConnectedClients || sessionData.roundNumber === 1) {
        openBrowser(sessionData.url);
      }
    }
    console.error(`[Pujangga] Review surface active: ${sessionData.url}`);
    console.error(`[Pujangga] Round ${sessionData.roundNumber} waiting for review in browser... (Press Ctrl+C to pause)`);
    let aborted = false;
    const abortController = new AbortController();
    process.on("SIGINT", () => {
      aborted = true;
      abortController.abort();
      console.error(`
[Pujangga] Review paused. State preserved. Run 'pujangga "${file}"' anytime to resume.`);
      process.exit(0);
    });
    const waitData = await new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}/api/sessions/${sessionData.sessionId}/wait`,
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Wait request failed with status: ${res.statusCode}`));
            return;
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.setTimeout(0);
      req.on("error", (err) => {
        if (aborted) return;
        reject(err);
      });
      abortController.signal.addEventListener("abort", () => {
        req.destroy();
      });
    });
    process.stdout.write(waitData.reportMarkdown + "\n");
    process.exit(0);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(`[Pujangga Error]`, err.message || err);
    process.exit(1);
  }
}
function createCli() {
  const program = new Command();
  program.name("pujangga").description("Editorial writing review surface for AI agents and human editors").version("1.0.0").argument("[file]", "Draft markdown file to review").option("--no-open", "Do not automatically open the browser").action(async (file, options) => {
    if (file) {
      await handleReview(file, options || {});
    } else {
      program.help();
    }
  });
  program.command("review <file>").description("Submit or resume a document review in the Pujangga web interface").option("--no-open", "Do not automatically open the browser").action(handleReview);
  program.command("status").description("Check daemon health and active review sessions").action(async () => {
    const status = await getDaemonStatus();
    if (!status.running) {
      console.log("Pujangga daemon is currently stopped.");
      return;
    }
    console.log(`Pujangga Daemon: RUNNING`);
    console.log(`Port: ${status.port}`);
    console.log(`PID: ${status.pid}`);
    console.log(`Uptime: ${status.details?.uptimeSeconds || 0}s`);
    const sessions = status.details?.sessions || [];
    if (sessions.length > 0) {
      console.log(`
Active Review Sessions (${sessions.length}):`);
      for (const s of sessions) {
        console.log(` - [${s.status.toUpperCase()}] ${s.title} (${s.roundsCount} rounds)`);
        console.log(`   File: ${s.filePath}`);
        console.log(`   URL:  http://localhost:${status.port}/review/${s.id}`);
      }
    } else {
      console.log("\nNo active review sessions.");
    }
  });
  program.command("stop").description("Stop the Pujangga background daemon").action(async () => {
    const stopped = await stopDaemon();
    if (stopped) {
      console.log("Pujangga daemon stopped.");
    } else {
      console.log("Pujangga daemon was not running.");
    }
  });
  return program;
}
export {
  createCli,
  openBrowser
};
