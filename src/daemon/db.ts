import nodeModule from 'node:module';
const require = nodeModule.createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: any };
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  Session,
  Revision,
  InlineComment,
  LockedText,
  SessionDetails,
  ReviewStatus,
  SubmitReviewRequest,
} from '../shared/types.js';

export function getPujanggaDir(): string {
  const dir = path.join(os.homedir(), '.pujangga');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDatabasePath(): string {
  return path.join(getPujanggaDir(), 'pujangga.db');
}

export class DatabaseService {
  private db: any;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || getDatabasePath();
    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
  }

  private initSchema() {
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

      CREATE TABLE IF NOT EXISTS locked_texts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        section_heading TEXT,
        context_before TEXT,
        context_after TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);

    // Safely migrate existing databases if columns do not exist
    try {
      this.db.exec(`ALTER TABLE locked_texts ADD COLUMN section_heading TEXT;`);
    } catch {}
    try {
      this.db.exec(`ALTER TABLE locked_texts ADD COLUMN context_before TEXT;`);
    } catch {}
    try {
      this.db.exec(`ALTER TABLE locked_texts ADD COLUMN context_after TEXT;`);
    } catch {}
  }

  public generateSessionId(filePath: string): string {
    const normalized = path.resolve(filePath);
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  public registerSession(filePath: string, workspaceDir: string, contentMarkdown: string): {
    session: Session;
    revision: Revision;
    isNewRound: boolean;
  } {
    const normalizedPath = path.resolve(filePath);
    const sessionId = this.generateSessionId(normalizedPath);
    const now = Date.now();
    const title = path.basename(normalizedPath);

    // Get or create session
    const existingSession = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    let session: Session;

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
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
    } else {
      // If the session was previously finalized as satisfied, reset old revisions, comments, and locked texts
      // so this new review starts completely fresh from Round 1
      if (existingSession.status === 'satisfied') {
        this.db.prepare('DELETE FROM revisions WHERE session_id = ?').run(sessionId);
        this.db.prepare('DELETE FROM inline_comments WHERE session_id = ?').run(sessionId);
        this.db.prepare('DELETE FROM locked_texts WHERE session_id = ?').run(sessionId);
      }

      this.db.prepare('UPDATE sessions SET updated_at = ?, status = ? WHERE id = ?')
        .run(now, 'active', sessionId);
      session = {
        id: existingSession.id,
        filePath: existingSession.file_path,
        workspaceDir: existingSession.workspace_dir,
        title: existingSession.title,
        status: 'active',
        createdAt: existingSession.created_at,
        updatedAt: now,
      };
    }

    // Get revisions for session
    const revisions = this.getRevisions(sessionId);
    let currentRevision: Revision;
    let isNewRound = false;

    if (revisions.length === 0) {
      // Round 1
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
        createdAt: now,
      };
      isNewRound = true;
    } else {
      const latest = revisions[revisions.length - 1];
      if (latest.submittedAt) {
        // Previous round was submitted; this is a new round from the agent!
        const nextRound = latest.roundNumber + 1;
        const revId = crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO revisions (id, session_id, round_number, content_markdown, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(revId, sessionId, nextRound, contentMarkdown, now);

        // Mark previous round comments as resolved
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
          createdAt: now,
        };
        isNewRound = true;
      } else {
        // Current round still in progress; update content if agent updated it before submit
        this.db.prepare('UPDATE revisions SET content_markdown = ? WHERE id = ?')
          .run(contentMarkdown, latest.id);
        currentRevision = {
          ...latest,
          contentMarkdown,
        };
        isNewRound = false;
      }
    }

    return { session, revision: currentRevision, isNewRound };
  }

  public getSession(sessionId: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) return null;
    return {
      id: row.id,
      filePath: row.file_path,
      workspaceDir: row.workspace_dir,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public getRevisions(sessionId: string): Revision[] {
    const rows = this.db.prepare('SELECT * FROM revisions WHERE session_id = ? ORDER BY round_number ASC').all(sessionId) as any[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      roundNumber: r.round_number,
      contentMarkdown: r.content_markdown,
      userEditedMarkdown: r.user_edited_markdown,
      overallComment: r.overall_comment,
      status: r.status,
      createdAt: r.created_at,
      submittedAt: r.submitted_at,
    }));
  }

  public getComments(sessionId: string): InlineComment[] {
    const rows = this.db.prepare('SELECT * FROM inline_comments WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
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
      resolvedAtRound: c.resolved_at_round,
    }));
  }

  public getLockedTexts(sessionId: string): LockedText[] {
    const rows = this.db.prepare('SELECT * FROM locked_texts WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
    return rows.map((l) => ({
      id: l.id,
      sessionId: l.session_id,
      text: l.text,
      roundNumber: l.round_number,
      createdAt: l.created_at,
      sectionHeading: l.section_heading || undefined,
      contextBefore: l.context_before || undefined,
      contextAfter: l.context_after || undefined,
    }));
  }

  public addLockedText(
    sessionId: string,
    lock: {
      id?: string;
      text: string;
      roundNumber: number;
      sectionHeading?: string;
      contextBefore?: string;
      contextAfter?: string;
    }
  ): LockedText {
    const id = lock.id || crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT OR REPLACE INTO locked_texts (
        id, session_id, text, round_number, created_at,
        section_heading, context_before, context_after
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      lock.text,
      lock.roundNumber,
      now,
      lock.sectionHeading || null,
      lock.contextBefore || null,
      lock.contextAfter || null
    );
    return {
      id,
      sessionId,
      text: lock.text,
      roundNumber: lock.roundNumber,
      createdAt: now,
      sectionHeading: lock.sectionHeading,
      contextBefore: lock.contextBefore,
      contextAfter: lock.contextAfter,
    };
  }

  public removeLockedText(lockId: string): void {
    this.db.prepare('DELETE FROM locked_texts WHERE id = ?').run(lockId);
  }

  public getSessionDetails(sessionId: string, activePort: number = 4173): SessionDetails | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const revisions = this.getRevisions(sessionId);
    const currentRevision = revisions[revisions.length - 1];
    const previousRevision = revisions.length > 1 ? revisions[revisions.length - 2] : null;
    const comments = this.getComments(sessionId);
    const lockedTexts = this.getLockedTexts(sessionId);

    return {
      session,
      currentRevision,
      previousRevision,
      revisions,
      comments,
      lockedTexts,
      activePort,
    };
  }

  public submitReview(
    sessionId: string,
    revisionId: string,
    payload: SubmitReviewRequest
  ): {
    revision: Revision;
    session: Session;
  } {
    const now = Date.now();
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const revisionRow = this.db.prepare('SELECT * FROM revisions WHERE id = ?').get(revisionId) as any;
    if (!revisionRow) throw new Error(`Revision ${revisionId} not found`);

    const roundNumber = revisionRow.round_number;
    const nextSessionStatus = payload.status === 'SATISFIED' ? 'satisfied' : 'revising';

    // 1. Update revision
    this.db.prepare(`
      UPDATE revisions
      SET user_edited_markdown = ?, overall_comment = ?, status = ?, submitted_at = ?
      WHERE id = ?
    `).run(payload.userEditedMarkdown, payload.overallComment, payload.status, now, revisionId);

    // 2. Update session status
    this.db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run(nextSessionStatus, now, sessionId);

    if (payload.status === 'SATISFIED') {
      // Clear all comments for this session upon satisfaction and finalization
      this.db.prepare('DELETE FROM inline_comments WHERE session_id = ?').run(sessionId);
      // Clear all locked texts for this session upon finalization
      this.db.prepare('DELETE FROM locked_texts WHERE session_id = ?').run(sessionId);
      // Clear older revision history, retaining only the final approved revision
      this.db.prepare('DELETE FROM revisions WHERE session_id = ? AND id != ?').run(sessionId, revisionId);
    } else {
      // 3. Mark previous open comments as resolved by this round
      this.db.prepare(`
        UPDATE inline_comments
        SET status = 'resolved', resolved_at_round = ?
        WHERE session_id = ? AND status = 'open' AND round_number < ?
      `).run(roundNumber, sessionId, roundNumber);

      // 4. Insert new inline comments for this round
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
          c.contextBefore || '',
          c.contextAfter || '',
          c.fromPos || 0,
          c.toPos || 0,
          c.commentText,
          roundNumber,
          now
        );
      }

      // 5. Ensure any submitted locked texts are saved
      if (payload.lockedTexts && Array.isArray(payload.lockedTexts)) {
        for (const lt of payload.lockedTexts) {
          this.addLockedText(sessionId, {
            id: lt.id,
            text: lt.text,
            roundNumber,
            sectionHeading: lt.sectionHeading,
            contextBefore: lt.contextBefore,
            contextAfter: lt.contextAfter,
          });
        }
      }
    }

    const updatedSession = this.getSession(sessionId)!;
    const updatedRevision = this.getRevisions(sessionId).find((r) => r.id === revisionId)!;

    return {
      revision: updatedRevision,
      session: updatedSession,
    };
  }

  public listSessions(): Array<Session & { roundsCount: number; lastModified: number }> {
    const rows = this.db.prepare(`
      SELECT s.*, COUNT(r.id) as rounds_count
      FROM sessions s
      LEFT JOIN revisions r ON s.id = r.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      workspaceDir: r.workspace_dir,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      roundsCount: r.rounds_count,
      lastModified: r.updated_at,
    }));
  }
}
