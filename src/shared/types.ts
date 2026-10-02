export type ReviewStatus = 'NEEDS_REVISION' | 'SATISFIED';
export type SessionStatus = 'active' | 'revising' | 'satisfied';
export type CommentStatus = 'open' | 'resolved';

export interface InlineComment {
  id: string;
  revisionId: string;
  sessionId: string;
  anchorText: string;
  contextBefore?: string;
  contextAfter?: string;
  fromPos?: number;
  toPos?: number;
  commentText: string;
  status: CommentStatus;
  roundNumber: number;
  createdAt: number;
  resolvedAtRound?: number | null;
}

export interface Revision {
  id: string;
  sessionId: string;
  roundNumber: number;
  contentMarkdown: string;
  userEditedMarkdown?: string | null;
  overallComment?: string | null;
  status?: ReviewStatus | null;
  createdAt: number;
  submittedAt?: number | null;
}

export interface Session {
  id: string;
  filePath: string;
  workspaceDir: string;
  title: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionDetails {
  session: Session;
  currentRevision: Revision;
  previousRevision?: Revision | null;
  revisions: Revision[];
  comments: InlineComment[];
  activePort: number;
}

export interface RegisterSessionRequest {
  filePath: string;
  workspaceDir: string;
  contentMarkdown: string;
}

export interface RegisterSessionResponse {
  sessionId: string;
  roundNumber: number;
  url: string;
  isNewRound: boolean;
}

export interface SubmitReviewRequest {
  userEditedMarkdown: string;
  overallComment: string;
  status: ReviewStatus;
  inlineComments: Array<{
    id?: string;
    anchorText: string;
    contextBefore?: string;
    contextAfter?: string;
    fromPos?: number;
    toPos?: number;
    commentText: string;
  }>;
}

export interface WaitReviewResponse {
  status: ReviewStatus;
  roundNumber: number;
  filePath: string;
  overallComment: string;
  inlineComments: Array<{
    anchorText: string;
    commentText: string;
    contextBefore?: string;
  }>;
  hasDirectEdits: boolean;
  diffSummary?: string;
  reportMarkdown: string;
}

export interface DaemonInfo {
  pid: number;
  port: number;
  startedAt: number;
}
