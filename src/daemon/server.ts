import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseService, getPujanggaDir } from './db.js';
import {
  RegisterSessionRequest,
  RegisterSessionResponse,
  SubmitReviewRequest,
  WaitReviewResponse,
} from '../shared/types.js';
import { generateAgentReport } from '../shared/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  dbPath?: string;
  staticDir?: string;
}

export class PujanggaServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private db: DatabaseService;
  private port: number;
  private staticDir: string;
  private startedAt: number;
  private pendingWaiters: Map<string, Array<{ res: http.ServerResponse; timer?: NodeJS.Timeout }>> = new Map();
  private wsClients: Map<string, Set<WebSocket>> = new Map();

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 4173;
    this.db = new DatabaseService(options.dbPath);
    this.startedAt = Date.now();

    // Default static dir is dist/web relative to root
    this.staticDir = options.staticDir || path.resolve(__dirname, '../../dist/web');

    this.server = http.createServer(this.handleHttpRequest.bind(this));
    // Disable request and idle timeouts so review wait connections can remain open indefinitely
    this.server.requestTimeout = 0;
    this.server.headersTimeout = 0;
    this.server.timeout = 0;
    this.server.keepAliveTimeout = 0;

    this.wss = new WebSocketServer({ noServer: true });

    this.setupWebSocket();
    this.setupUpgrade();
  }

  private setupUpgrade() {
    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId') || '';

      if (!sessionId) {
        ws.close(1008, 'Missing sessionId');
        return;
      }

      if (!this.wsClients.has(sessionId)) {
        this.wsClients.set(sessionId, new Set());
      }
      this.wsClients.get(sessionId)!.add(ws);

      // Send initial state
      const details = this.db.getSessionDetails(sessionId, this.port);
      if (details) {
        ws.send(JSON.stringify({ type: 'SESSION_INIT', payload: details }));
      }

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG' }));
          }
        } catch {
          // ignore
        }
      });

      ws.on('close', () => {
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

  private broadcastToSession(sessionId: string, message: any) {
    const clients = this.wsClients.get(sessionId);
    if (!clients) return;
    const msgStr = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    }
  }

  private async parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 20 * 1024 * 1024) {
          reject(new Error('Body too large'));
        }
      });
      req.on('end', () => {
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
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  }

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const method = req.method;
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    try {
      // 1. API: Register session from CLI
      if (method === 'POST' && pathname === '/api/sessions/register') {
        const body = (await this.parseJsonBody(req)) as RegisterSessionRequest;
        if (!body.filePath || !body.workspaceDir) {
          this.sendJson(res, 400, { error: 'Missing filePath or workspaceDir' });
          return;
        }

        const { session, revision, isNewRound } = this.db.registerSession(
          body.filePath,
          body.workspaceDir,
          body.contentMarkdown || ''
        );

        // Notify active browser tabs that a new round or update has landed!
        const details = this.db.getSessionDetails(session.id, this.port);
        this.broadcastToSession(session.id, {
          type: 'ROUND_UPDATED',
          payload: details,
          isNewRound,
        });

        const hasConnectedClients = (this.wsClients.get(session.id)?.size || 0) > 0;

        const response: RegisterSessionResponse = {
          sessionId: session.id,
          roundNumber: revision.roundNumber,
          url: `http://localhost:${this.port}/review/${session.id}`,
          isNewRound,
          hasConnectedClients,
        };

        this.sendJson(res, 200, response);
        return;
      }

      // 2. API: Get Session Details
      if (method === 'GET' && pathname.startsWith('/api/sessions/') && !pathname.endsWith('/wait')) {
        const sessionId = pathname.replace('/api/sessions/', '');
        const details = this.db.getSessionDetails(sessionId, this.port);
        if (!details) {
          this.sendJson(res, 404, { error: 'Session not found' });
          return;
        }
        this.sendJson(res, 200, details);
        return;
      }

      // 3. API: CLI Wait for Review Submission
      if (method === 'GET' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/wait')) {
        const parts = pathname.split('/');
        const sessionId = parts[3]; // /api/sessions/:id/wait

        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: 'Session not found' });
          return;
        }

        // Check if current revision is already submitted
        const revisions = this.db.getRevisions(sessionId);
        const latestRevision = revisions[revisions.length - 1];
        if (latestRevision && latestRevision.submittedAt && latestRevision.status) {
          const inlineComments = this.db.getComments(sessionId).filter((c) => c.roundNumber === latestRevision.roundNumber);
          const lockedTexts = this.db.getLockedTexts(sessionId);
          const report = generateAgentReport({
            status: latestRevision.status,
            roundNumber: latestRevision.roundNumber,
            filePath: session.filePath,
            originalMarkdown: latestRevision.contentMarkdown,
            userEditedMarkdown: latestRevision.userEditedMarkdown,
            overallComment: latestRevision.overallComment,
            inlineComments,
            lockedTexts,
          });

          const waitResponse: WaitReviewResponse = {
            status: latestRevision.status,
            roundNumber: latestRevision.roundNumber,
            filePath: session.filePath,
            overallComment: latestRevision.overallComment,
            inlineComments,
            lockedTexts,
            hasDirectEdits: latestRevision.userEditedMarkdown !== undefined && latestRevision.userEditedMarkdown !== latestRevision.contentMarkdown,
            reportMarkdown: report,
          };

          this.sendJson(res, 200, waitResponse);
          return;
        }

        req.setTimeout(0);
        res.setTimeout(0);

        // Add to pending waiters
        if (!this.pendingWaiters.has(sessionId)) {
          this.pendingWaiters.set(sessionId, []);
        }

        const waiters = this.pendingWaiters.get(sessionId)!;
        const waiterEntry = { res };
        waiters.push(waiterEntry);

        req.on('close', () => {
          const currentWaiters = this.pendingWaiters.get(sessionId);
          if (currentWaiters) {
            const idx = currentWaiters.indexOf(waiterEntry);
            if (idx !== -1) currentWaiters.splice(idx, 1);
          }
        });
        return;
      }

      // 4. API: Add Locked Text
      if (method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/locked-texts')) {
        const parts = pathname.split('/');
        const sessionId = parts[3];

        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: 'Session not found' });
          return;
        }

        const body = await this.parseJsonBody(req);
        if (!body.text || !body.text.trim()) {
          this.sendJson(res, 400, { error: 'Missing locked text content' });
          return;
        }

        const revisions = this.db.getRevisions(sessionId);
        const currentRevision = revisions[revisions.length - 1];
        const roundNumber = currentRevision ? currentRevision.roundNumber : 1;

        const lock = this.db.addLockedText(sessionId, {
          id: body.id,
          text: body.text,
          roundNumber,
        });

        const updatedDetails = this.db.getSessionDetails(sessionId, this.port);
        this.broadcastToSession(sessionId, {
          type: 'LOCKED_TEXTS_UPDATED',
          payload: updatedDetails,
        });

        this.sendJson(res, 200, lock);
        return;
      }

      // 4b. API: Remove Locked Text
      if (method === 'DELETE' && pathname.startsWith('/api/sessions/') && pathname.includes('/locked-texts/')) {
        const parts = pathname.split('/');
        const sessionId = parts[3];
        const lockId = parts[5];

        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: 'Session not found' });
          return;
        }

        this.db.removeLockedText(lockId);

        const updatedDetails = this.db.getSessionDetails(sessionId, this.port);
        this.broadcastToSession(sessionId, {
          type: 'LOCKED_TEXTS_UPDATED',
          payload: updatedDetails,
        });

        this.sendJson(res, 200, { success: true });
        return;
      }

      // 5. API: Submit Review from Browser
      if (method === 'POST' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/submit')) {
        const parts = pathname.split('/');
        const sessionId = parts[3];

        const session = this.db.getSession(sessionId);
        if (!session) {
          this.sendJson(res, 404, { error: 'Session not found' });
          return;
        }

        const body = (await this.parseJsonBody(req)) as SubmitReviewRequest;
        const revisions = this.db.getRevisions(sessionId);
        const currentRevision = revisions[revisions.length - 1];
        if (!currentRevision) {
          this.sendJson(res, 400, { error: 'No active revision found for session' });
          return;
        }

        if (body.status === 'NEEDS_REVISION') {
          const hasDirective = (body.overallComment || '').trim().length > 0;
          const hasInlineNotes = (body.inlineComments || []).some(
            (c) => (c.commentText || '').trim().length > 0
          );
          if (!hasDirective && !hasInlineNotes) {
            this.sendJson(res, 400, {
              error:
                'Unable to request revision without any new notes or directive. Please provide guidance for the agent.',
            });
            return;
          }
        }

        // 1. Save submission to SQLite
        const { revision: updatedRevision } = this.db.submitReview(sessionId, currentRevision.id, body);

        // 2. Write direct edits back to file on disk
        if (body.userEditedMarkdown !== undefined && body.userEditedMarkdown !== null) {
          try {
            fs.writeFileSync(session.filePath, body.userEditedMarkdown, 'utf8');
          } catch (writeErr: any) {
            console.error(`Failed to write edits to ${session.filePath}:`, writeErr);
          }
        }

        // 3. Generate Agent Report
        const lockedTexts = this.db.getLockedTexts(sessionId);
        const report = generateAgentReport({
          status: body.status,
          roundNumber: currentRevision.roundNumber,
          filePath: session.filePath,
          originalMarkdown: currentRevision.contentMarkdown,
          userEditedMarkdown: body.userEditedMarkdown,
          overallComment: body.overallComment,
          inlineComments: body.inlineComments || [],
          lockedTexts,
        });

        // 4. Unblock any waiting CLI instances for this session
        const waiters = this.pendingWaiters.get(sessionId) || [];
        const waitResponse: WaitReviewResponse = {
          status: body.status,
          roundNumber: currentRevision.roundNumber,
          filePath: session.filePath,
          overallComment: body.overallComment,
          inlineComments: body.inlineComments || [],
          lockedTexts,
          hasDirectEdits: currentRevision.contentMarkdown !== body.userEditedMarkdown,
          reportMarkdown: report,
        };

        while (waiters.length > 0) {
          const waiter = waiters.shift();
          if (waiter && !waiter.res.writableEnded) {
            this.sendJson(waiter.res, 200, waitResponse);
          }
        }

        // 5. Notify browser tabs via WebSocket
        const updatedDetails = this.db.getSessionDetails(sessionId, this.port);
        this.broadcastToSession(sessionId, {
          type: body.status === 'SATISFIED' ? 'SESSION_SATISFIED' : 'REVISING_WAIT',
          payload: updatedDetails,
        });

        this.sendJson(res, 200, { success: true, roundNumber: currentRevision.roundNumber });
        return;
      }

      // 5. API: Status & List sessions
      if (method === 'GET' && pathname === '/api/status') {
        const sessions = this.db.listSessions();
        this.sendJson(res, 200, {
          status: 'running',
          pid: process.pid,
          port: this.port,
          uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
          sessions,
        });
        return;
      }

      // 6. API: Shutdown
      if (method === 'POST' && pathname === '/api/shutdown') {
        this.sendJson(res, 200, { status: 'stopping' });
        setTimeout(() => this.stop(), 100);
        return;
      }

      // 7. Static Asset Serving
      this.serveStaticFile(req, res, pathname);
    } catch (err: any) {
      console.error('Request error:', err);
      if (!res.writableEnded) {
        this.sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
    }
  }

  private serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
    if (!fs.existsSync(this.staticDir)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><h1>Pujangga Daemon Running</h1><p>UI assets not yet built. Run <code>pnpm build</code>.</p></body></html>`);
      return;
    }

    let filePath = path.join(this.staticDir, pathname);

    // If directory or direct route like /review/:id, serve index.html (SPA)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(this.staticDir, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=UTF-8',
      '.js': 'application/javascript; charset=UTF-8',
      '.css': 'text/css; charset=UTF-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        resolve(this.port);
      });
      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // If default port is taken, try port + 1
          this.port++;
          this.server.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}
