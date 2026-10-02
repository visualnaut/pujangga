// src/daemon/daemon-entry.ts
import fs3 from "fs";
import path3 from "path";

// src/daemon/server.ts
import http from "http";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";

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
function getDatabasePath() {
  return path.join(getPujanggaDir(), "pujangga.db");
}
var DatabaseService = class {
  db;
  constructor(dbPath) {
    const resolvedPath = dbPath || getDatabasePath();
    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
  }
  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        workspace_dir TEXT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS revisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        content_markdown TEXT NOT NULL,
        user_edited_markdown TEXT,
        overall_comment TEXT,
        status TEXT,
        created_at INTEGER,
        submitted_at INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS inline_comments (
        id TEXT PRIMARY KEY,
        revision_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        anchor_text TEXT NOT NULL,
        context_before TEXT,
        context_after TEXT,
        from_pos INTEGER,
        to_pos INTEGER,
        comment_text TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        round_number INTEGER NOT NULL,
        created_at INTEGER,
        resolved_at_round INTEGER
      );
    `);
  }
  generateSessionId(filePath) {
    const normalized = path.resolve(filePath);
    return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }
  registerSession(filePath, workspaceDir, contentMarkdown) {
    const normalizedPath = path.resolve(filePath);
    const sessionId = this.generateSessionId(normalizedPath);
    const now = Date.now();
    const title = path.basename(normalizedPath);
    const existingSession = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    let session;
    if (!existingSession) {
      this.db.prepare(`
        INSERT INTO sessions (id, file_path, workspace_dir, title, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
      `).run(sessionId, normalizedPath, workspaceDir, title, now, now);
      session = {
        id: sessionId,
        filePath: normalizedPath,
        workspaceDir,
        title,
        status: "active",
        createdAt: now,
        updatedAt: now
      };
    } else {
      if (existingSession.status === "satisfied") {
        this.db.prepare("DELETE FROM revisions WHERE session_id = ?").run(sessionId);
        this.db.prepare("DELETE FROM inline_comments WHERE session_id = ?").run(sessionId);
      }
      this.db.prepare("UPDATE sessions SET updated_at = ?, status = ? WHERE id = ?").run(now, "active", sessionId);
      session = {
        id: existingSession.id,
        filePath: existingSession.file_path,
        workspaceDir: existingSession.workspace_dir,
        title: existingSession.title,
        status: "active",
        createdAt: existingSession.created_at,
        updatedAt: now
      };
    }
    const revisions = this.getRevisions(sessionId);
    let currentRevision;
    let isNewRound = false;
    if (revisions.length === 0) {
      const revId = crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO revisions (id, session_id, round_number, content_markdown, created_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(revId, sessionId, contentMarkdown, now);
      currentRevision = {
        id: revId,
        sessionId,
        roundNumber: 1,
        contentMarkdown,
        createdAt: now
      };
      isNewRound = true;
    } else {
      const latest = revisions[revisions.length - 1];
      if (latest.submittedAt) {
        const nextRound = latest.roundNumber + 1;
        const revId = crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO revisions (id, session_id, round_number, content_markdown, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(revId, sessionId, nextRound, contentMarkdown, now);
        this.db.prepare(`
          UPDATE inline_comments
          SET status = 'resolved', resolved_at_round = ?
          WHERE session_id = ? AND status = 'open' AND round_number < ?
        `).run(nextRound, sessionId, nextRound);
        currentRevision = {
          id: revId,
          sessionId,
          roundNumber: nextRound,
          contentMarkdown,
          createdAt: now
        };
        isNewRound = true;
      } else {
        this.db.prepare("UPDATE revisions SET content_markdown = ? WHERE id = ?").run(contentMarkdown, latest.id);
        currentRevision = {
          ...latest,
          contentMarkdown
        };
        isNewRound = false;
      }
    }
    return { session, revision: currentRevision, isNewRound };
  }
  getSession(sessionId) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!row) return null;
    return {
      id: row.id,
      filePath: row.file_path,
      workspaceDir: row.workspace_dir,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  getRevisions(sessionId) {
    const rows = this.db.prepare("SELECT * FROM revisions WHERE session_id = ? ORDER BY round_number ASC").all(sessionId);
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      roundNumber: r.round_number,
      contentMarkdown: r.content_markdown,
      userEditedMarkdown: r.user_edited_markdown,
      overallComment: r.overall_comment,
      status: r.status,
      createdAt: r.created_at,
      submittedAt: r.submitted_at
    }));
  }
  getComments(sessionId) {
    const rows = this.db.prepare("SELECT * FROM inline_comments WHERE session_id = ? ORDER BY created_at ASC").all(sessionId);
    return rows.map((c) => ({
      id: c.id,
      revisionId: c.revision_id,
      sessionId: c.session_id,
      anchorText: c.anchor_text,
      contextBefore: c.context_before,
      contextAfter: c.context_after,
      fromPos: c.from_pos,
      toPos: c.to_pos,
      commentText: c.comment_text,
      status: c.status,
      roundNumber: c.round_number,
      createdAt: c.created_at,
      resolvedAtRound: c.resolved_at_round
    }));
  }
  getSessionDetails(sessionId, activePort = 4173) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const revisions = this.getRevisions(sessionId);
    const currentRevision = revisions[revisions.length - 1];
    const previousRevision = revisions.length > 1 ? revisions[revisions.length - 2] : null;
    const comments = this.getComments(sessionId);
    return {
      session,
      currentRevision,
      previousRevision,
      revisions,
      comments,
      activePort
    };
  }
  submitReview(sessionId, revisionId, payload) {
    const now = Date.now();
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const revisionRow = this.db.prepare("SELECT * FROM revisions WHERE id = ?").get(revisionId);
    if (!revisionRow) throw new Error(`Revision ${revisionId} not found`);
    const roundNumber = revisionRow.round_number;
    const nextSessionStatus = payload.status === "SATISFIED" ? "satisfied" : "revising";
    this.db.prepare(`
      UPDATE revisions
      SET user_edited_markdown = ?, overall_comment = ?, status = ?, submitted_at = ?
      WHERE id = ?
    `).run(payload.userEditedMarkdown, payload.overallComment, payload.status, now, revisionId);
    this.db.prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?").run(nextSessionStatus, now, sessionId);
    if (payload.status === "SATISFIED") {
      this.db.prepare("DELETE FROM inline_comments WHERE session_id = ?").run(sessionId);
      this.db.prepare("DELETE FROM revisions WHERE session_id = ? AND id != ?").run(sessionId, revisionId);
    } else {
      this.db.prepare(`
        UPDATE inline_comments
        SET status = 'resolved', resolved_at_round = ?
        WHERE session_id = ? AND status = 'open' AND round_number < ?
      `).run(roundNumber, sessionId, roundNumber);
      for (const c of payload.inlineComments) {
        const commentId = c.id || crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO inline_comments
          (id, revision_id, session_id, anchor_text, context_before, context_after, from_pos, to_pos, comment_text, status, round_number, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        `).run(
          commentId,
          revisionId,
          sessionId,
          c.anchorText,
          c.contextBefore || "",
          c.contextAfter || "",
          c.fromPos || 0,
          c.toPos || 0,
          c.commentText,
          roundNumber,
          now
        );
      }
    }
    const updatedSession = this.getSession(sessionId);
    const updatedRevision = this.getRevisions(sessionId).find((r) => r.id === revisionId);
    return {
      revision: updatedRevision,
      session: updatedSession
    };
  }
  listSessions() {
    const rows = this.db.prepare(`
      SELECT s.*, COUNT(r.id) as rounds_count
      FROM sessions s
      LEFT JOIN revisions r ON s.id = r.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `).all();
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      workspaceDir: r.workspace_dir,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      roundsCount: r.rounds_count,
      lastModified: r.updated_at
    }));
  }
};

// src/shared/diff.ts
import * as diff from "diff";
function summarizeDiff(oldText, newText, fileName = "document.md") {
  if (oldText === newText) {
    return {
      hasChanges: false,
      addedCount: 0,
      removedCount: 0,
      summaryText: "No direct edits were made.",
      unifiedDiff: ""
    };
  }
  const patch = diff.createPatch(fileName, oldText, newText, "Previous", "Current");
  const lineDiff = diff.diffLines(oldText, newText);
  let addedLines = 0;
  let removedLines = 0;
  for (const part of lineDiff) {
    if (part.added) {
      addedLines += (part.value.match(/\n/g) || []).length || 1;
    } else if (part.removed) {
      removedLines += (part.value.match(/\n/g) || []).length || 1;
    }
  }
  const wordChanges = diff.diffWords(oldText, newText);
  let addedWords = 0;
  let removedWords = 0;
  for (const w of wordChanges) {
    if (w.added) addedWords += w.value.trim().split(/\s+/).filter(Boolean).length;
    if (w.removed) removedWords += w.value.trim().split(/\s+/).filter(Boolean).length;
  }
  const summary = `Modified text (+${addedWords} words, -${removedWords} words across +${addedLines}/-${removedLines} lines).`;
  return {
    hasChanges: true,
    addedCount: addedWords,
    removedCount: removedWords,
    summaryText: summary,
    unifiedDiff: patch
  };
}

// src/shared/reporter.ts
function generateAgentReport(options) {
  const {
    status,
    roundNumber,
    filePath,
    originalMarkdown,
    userEditedMarkdown,
    overallComment,
    inlineComments
  } = options;
  if (status === "SATISFIED") {
    return [
      `# \u2728 Pujangga Review: APPROVED`,
      `**Status**: SATISFIED`,
      `**Round**: ${roundNumber}`,
      `**File**: \`${filePath}\``,
      ``,
      `> The reviewer has approved this writing and marked it as **SATISFIED**!`,
      overallComment ? `
### Final Note from Reviewer
${overallComment}
` : "",
      `---`,
      `### Directives for Agent:`,
      `1. Do NOT call \`pujangga review\` again. The review loop for this document is complete.`,
      `2. You may now proceed with the next task or present the finalized result.`
    ].filter(Boolean).join("\n");
  }
  const diff2 = summarizeDiff(originalMarkdown, userEditedMarkdown, filePath);
  const lines = [
    `# \u270D\uFE0F Pujangga Review Feedback (Round ${roundNumber})`,
    `**Status**: NEEDS_REVISION`,
    `**File**: \`${filePath}\``,
    ``
  ];
  if (overallComment && overallComment.trim()) {
    lines.push(`## \u{1F3AF} Overall Directive`);
    lines.push(`> ${overallComment.trim().replace(/\n/g, "\n> ")}`);
    lines.push(``);
  }
  if (diff2.hasChanges) {
    lines.push(`## \u{1F4DD} Direct Edits Made by Reviewer`);
    lines.push(`The reviewer directly edited the text in the review interface. **The target file on disk has already been updated with these direct edits.**`);
    lines.push(`- **Summary**: ${diff2.summaryText}`);
    lines.push(``);
  }
  if (inlineComments && inlineComments.length > 0) {
    lines.push(`## \u{1F4AC} Inline Comments (${inlineComments.length} Action Items)`);
    inlineComments.forEach((c, idx) => {
      lines.push(`${idx + 1}. **Target Text**: "${c.anchorText}"`);
      if (c.contextBefore) {
        lines.push(`   *Context*: "...${c.contextBefore.trim()}..."`);
      }
      lines.push(`   *Feedback*: ${c.commentText}`);
      lines.push(``);
    });
  } else if (!diff2.hasChanges && (!overallComment || !overallComment.trim())) {
    lines.push(`*Note: Reviewer requested revisions without specific inline notes.*`);
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(`### Next Steps for Agent:`);
  lines.push(`1. Inspect the updated file at \`${filePath}\` (contains the reviewer's direct edits).`);
  if (inlineComments && inlineComments.length > 0) {
    lines.push(`2. Address each of the ${inlineComments.length} inline comment(s) above.`);
  }
  if (overallComment && overallComment.trim()) {
    lines.push(`3. Incorporate the overall directive into your revision.`);
  }
  lines.push(`4. Save your updated draft to \`${filePath}\`.`);
  lines.push(`5. Execute \`pujangga review "${filePath}"\` to present Round ${roundNumber + 1} for review.`);
  return lines.join("\n");
}

// src/daemon/server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PujanggaServer = class {
  server;
  wss;
  db;
  port;
  staticDir;
  startedAt;
  pendingWaiters = /* @__PURE__ */ new Map();
  wsClients = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.port = options.port || 4173;
    this.db = new DatabaseService(options.dbPath);
    this.startedAt = Date.now();
    this.staticDir = options.staticDir || path2.resolve(__dirname, "../../dist/web");
    this.server = http.createServer(this.handleHttpRequest.bind(this));
    this.server.requestTimeout = 0;
    this.server.headersTimeout = 0;
    this.server.timeout = 0;
    this.server.keepAliveTimeout = 0;
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocket();
    this.setupUpgrade();
  }
  setupUpgrade() {
    this.server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      if (url.pathname === "/ws") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }
  setupWebSocket() {
    this.wss.on("connection", (ws, request) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const sessionId = url.searchParams.get("sessionId") || "";
      if (!sessionId) {
        ws.close(1008, "Missing sessionId");
        return;
      }
      if (!this.wsClients.has(sessionId)) {
        this.wsClients.set(sessionId, /* @__PURE__ */ new Set());
      }
      this.wsClients.get(sessionId).add(ws);
      const details = this.db.getSessionDetails(sessionId, this.port);
      if (details) {
        ws.send(JSON.stringify({ type: "SESSION_INIT", payload: details }));
      }
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG" }));
          }
        } catch {
        }
      });
      ws.on("close", () => {
        const clientSet = this.wsClients.get(sessionId);
        if (clientSet) {
          clientSet.delete(ws);
          if (clientSet.size === 0) {
            this.wsClients.delete(sessionId);
          }
        }
      });
    });
  }
  broadcastToSession(sessionId, message) {
    const clients = this.wsClients.get(sessionId);
    if (!clients) return;
    const msgStr = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    }
  }
  async parseJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 20 * 1024 * 1024) {
          reject(new Error("Body too large"));
        }
      });
      req.on("end", () => {
        if (!body.trim()) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }
  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(data));
  }
  async handleHttpRequest(req, res) {
    const method = req.method;
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const pathname = url.pathname;
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }
    try {
      if (method === "POST" && pathname === "/api/sessions/register") {
        const body = await this.parseJsonBody(req);
        if (!body.filePath || !body.workspaceDir) {
          this.sendJson(res, 400, { error: "Missing filePath or workspaceDir" });
          return;
        }
        const { session, revision, isNewRound } = this.db.registerSession(
          body.filePath,
          body.workspaceDir,
          body.contentMarkdown || ""
        );
        const details = this.db.getSessionDetails(session.id, this.port);
        this.broadcastToSession(session.id, {
          type: "ROUND_UPDATED",
          payload: details,
          isNewRound
        });
        const hasConnectedClients = (this.wsClients.get(session.id)?.size || 0) > 0;
        const response = {
          sessionId: session.id,
          roundNumber: revision.roundNumber,
          url: `http://localhost:${this.port}/review/${session.id}`,
          isNewRound,
          hasConnectedClients
        };
        this.sendJson(res, 200, response);
        return;
      }
      if (method === "GET" && pathname.startsWith("/api/sessions/") && !pathname.endsWith("/wait")) {
        const sessionId = pathname.replace("/api/sessions/", "");
        const details = this.db.getSessionDetails(sessionId, this.port);
        if (!details) {
          this.sendJson(res, 404, { error: "Session not found" });
          return;
        }
        this.sendJson(res, 200, details);
        return;
      }
      if (method === "GET" && pathname.startsWith("/api/sessions/") && pathname.endsWith("/wait")) {
        const parts = pathname.split("/");
        const sessionId = parts[3];
        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: "Session not found" });
          return;
        }
        const revisions = this.db.getRevisions(sessionId);
        const latestRevision = revisions[revisions.length - 1];
        if (latestRevision && latestRevision.submittedAt && latestRevision.status) {
          const inlineComments = this.db.getComments(sessionId).filter((c) => c.roundNumber === latestRevision.roundNumber);
          const report = generateAgentReport({
            status: latestRevision.status,
            roundNumber: latestRevision.roundNumber,
            filePath: session.filePath,
            originalMarkdown: latestRevision.contentMarkdown,
            userEditedMarkdown: latestRevision.userEditedMarkdown,
            overallComment: latestRevision.overallComment,
            inlineComments
          });
          const waitResponse = {
            status: latestRevision.status,
            roundNumber: latestRevision.roundNumber,
            filePath: session.filePath,
            overallComment: latestRevision.overallComment,
            inlineComments,
            hasDirectEdits: latestRevision.userEditedMarkdown !== void 0 && latestRevision.userEditedMarkdown !== latestRevision.contentMarkdown,
            reportMarkdown: report
          };
          this.sendJson(res, 200, waitResponse);
          return;
        }
        req.setTimeout(0);
        res.setTimeout(0);
        if (!this.pendingWaiters.has(sessionId)) {
          this.pendingWaiters.set(sessionId, []);
        }
        const waiters = this.pendingWaiters.get(sessionId);
        const waiterEntry = { res };
        waiters.push(waiterEntry);
        req.on("close", () => {
          const currentWaiters = this.pendingWaiters.get(sessionId);
          if (currentWaiters) {
            const idx = currentWaiters.indexOf(waiterEntry);
            if (idx !== -1) currentWaiters.splice(idx, 1);
          }
        });
        return;
      }
      if (method === "POST" && pathname.startsWith("/api/sessions/") && pathname.endsWith("/submit")) {
        const parts = pathname.split("/");
        const sessionId = parts[3];
        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: "Session not found" });
          return;
        }
        const body = await this.parseJsonBody(req);
        const revisions = this.db.getRevisions(sessionId);
        const currentRevision = revisions[revisions.length - 1];
        if (!currentRevision) {
          this.sendJson(res, 400, { error: "No active revision found for session" });
          return;
        }
        if (body.status === "NEEDS_REVISION") {
          const hasDirective = (body.overallComment || "").trim().length > 0;
          const hasInlineNotes = (body.inlineComments || []).some(
            (c) => (c.commentText || "").trim().length > 0
          );
          if (!hasDirective && !hasInlineNotes) {
            this.sendJson(res, 400, {
              error: "Unable to request revision without any new notes or directive. Please provide guidance for the agent."
            });
            return;
          }
        }
        const { revision: updatedRevision } = this.db.submitReview(sessionId, currentRevision.id, body);
        if (body.userEditedMarkdown !== void 0 && body.userEditedMarkdown !== null) {
          try {
            fs2.writeFileSync(session.filePath, body.userEditedMarkdown, "utf8");
          } catch (writeErr) {
            console.error(`Failed to write edits to ${session.filePath}:`, writeErr);
          }
        }
        const report = generateAgentReport({
          status: body.status,
          roundNumber: currentRevision.roundNumber,
          filePath: session.filePath,
          originalMarkdown: currentRevision.contentMarkdown,
          userEditedMarkdown: body.userEditedMarkdown,
          overallComment: body.overallComment,
          inlineComments: body.inlineComments || []
        });
        const waiters = this.pendingWaiters.get(sessionId) || [];
        const waitResponse = {
          status: body.status,
          roundNumber: currentRevision.roundNumber,
          filePath: session.filePath,
          overallComment: body.overallComment,
          inlineComments: body.inlineComments || [],
          hasDirectEdits: currentRevision.contentMarkdown !== body.userEditedMarkdown,
          reportMarkdown: report
        };
        while (waiters.length > 0) {
          const waiter = waiters.shift();
          if (waiter && !waiter.res.writableEnded) {
            this.sendJson(waiter.res, 200, waitResponse);
          }
        }
        const updatedDetails = this.db.getSessionDetails(sessionId, this.port);
        this.broadcastToSession(sessionId, {
          type: body.status === "SATISFIED" ? "SESSION_SATISFIED" : "REVISING_WAIT",
          payload: updatedDetails
        });
        this.sendJson(res, 200, { success: true, roundNumber: currentRevision.roundNumber });
        return;
      }
      if (method === "GET" && pathname === "/api/status") {
        const sessions = this.db.listSessions();
        this.sendJson(res, 200, {
          status: "running",
          pid: process.pid,
          port: this.port,
          uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1e3),
          sessions
        });
        return;
      }
      if (method === "POST" && pathname === "/api/shutdown") {
        this.sendJson(res, 200, { status: "stopping" });
        setTimeout(() => this.stop(), 100);
        return;
      }
      this.serveStaticFile(req, res, pathname);
    } catch (err) {
      console.error("Request error:", err);
      if (!res.writableEnded) {
        this.sendJson(res, 500, { error: err.message || "Internal server error" });
      }
    }
  }
  serveStaticFile(req, res, pathname) {
    if (!fs2.existsSync(this.staticDir)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><body><h1>Pujangga Daemon Running</h1><p>UI assets not yet built. Run <code>pnpm build</code>.</p></body></html>`);
      return;
    }
    let filePath = path2.join(this.staticDir, pathname);
    if (!fs2.existsSync(filePath) || fs2.statSync(filePath).isDirectory()) {
      filePath = path2.join(this.staticDir, "index.html");
    }
    if (!fs2.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    const ext = path2.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=UTF-8",
      ".js": "application/javascript; charset=UTF-8",
      ".css": "text/css; charset=UTF-8",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs2.createReadStream(filePath).pipe(res);
  }
  async start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        resolve(this.port);
      });
      this.server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          this.port++;
          this.server.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }
  stop() {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
};

// src/daemon/daemon-entry.ts
var daemonJsonPath = path3.join(getPujanggaDir(), "daemon.json");
async function main() {
  const port = process.env.PUJANGGA_PORT ? parseInt(process.env.PUJANGGA_PORT, 10) : 4173;
  const server = new PujanggaServer({ port });
  const activePort = await server.start();
  console.log(`[Pujangga Daemon] Running on port ${activePort} (PID: ${process.pid})`);
  const info = {
    pid: process.pid,
    port: activePort,
    startedAt: Date.now()
  };
  fs3.writeFileSync(daemonJsonPath, JSON.stringify(info, null, 2), "utf8");
  const cleanup = () => {
    try {
      if (fs3.existsSync(daemonJsonPath)) {
        fs3.unlinkSync(daemonJsonPath);
      }
    } catch {
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", async () => {
    cleanup();
    await server.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    cleanup();
    await server.stop();
    process.exit(0);
  });
}
main().catch((err) => {
  console.error("[Pujangga Daemon] Fatal error:", err);
  process.exit(1);
});
