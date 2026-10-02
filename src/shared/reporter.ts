import { InlineComment, Revision, ReviewStatus } from './types.js';
import { summarizeDiff } from './diff.js';

export interface GenerateReportOptions {
  status: ReviewStatus;
  roundNumber: number;
  filePath: string;
  originalMarkdown: string;
  userEditedMarkdown: string;
  overallComment: string;
  inlineComments: Array<{
    anchorText: string;
    commentText: string;
    contextBefore?: string;
  }>;
  lockedTexts?: Array<{
    id?: string;
    text: string;
  }>;
}

/**
 * Generates an actionable, structured Markdown report intended for the agent harness stdout.
 */
export function generateAgentReport(options: GenerateReportOptions): string {
  const {
    status,
    roundNumber,
    filePath,
    originalMarkdown,
    userEditedMarkdown,
    overallComment,
    inlineComments,
    lockedTexts,
  } = options;

  if (status === 'SATISFIED') {
    return [
      `# ✨ Pujangga Review: APPROVED`,
      `**Status**: SATISFIED`,
      `**Round**: ${roundNumber}`,
      `**File**: \`${filePath}\``,
      ``,
      `> The reviewer has approved this writing and marked it as **SATISFIED**!`,
      overallComment ? `\n### Final Note from Reviewer\n${overallComment}\n` : '',
      `---`,
      `### Directives for Agent:`,
      `1. Do NOT call \`pujangga review\` again. The review loop for this document is complete.`,
      `2. You may now proceed with the next task or present the finalized result.`,
    ].filter(Boolean).join('\n');
  }

  // NEEDS_REVISION
  const diff = summarizeDiff(originalMarkdown, userEditedMarkdown, filePath);

  const lines: string[] = [
    `# ✍️ Pujangga Review Feedback (Round ${roundNumber})`,
    `**Status**: NEEDS_REVISION`,
    `**File**: \`${filePath}\``,
    ``,
  ];

  if (overallComment && overallComment.trim()) {
    lines.push(`## 🎯 Overall Directive`);
    lines.push(`> ${overallComment.trim().replace(/\n/g, '\n> ')}`);
    lines.push(``);
  }

  if (lockedTexts && lockedTexts.length > 0) {
    lines.push(`## 🔒 Locked Text Segments (CRITICAL: DO NOT MODIFY)`);
    lines.push(
      `The reviewer has locked the following text segment(s). They MUST remain VERBATIM in your revision — do not rephrase, edit, or delete:`
    );
    lockedTexts.forEach((lt, idx) => {
      lines.push(`${idx + 1}. "${lt.text.trim()}"`);
    });
    lines.push(``);
  }

  if (diff.hasChanges) {
    lines.push(`## 📝 Direct Edits Made by Reviewer`);
    lines.push(`The reviewer directly edited the text in the review interface. **The target file on disk has already been updated with these direct edits.**`);
    lines.push(`- **Summary**: ${diff.summaryText}`);
    lines.push(``);
  }

  if (inlineComments && inlineComments.length > 0) {
    lines.push(`## 💬 Inline Comments (${inlineComments.length} Action Items)`);
    inlineComments.forEach((c, idx) => {
      lines.push(`${idx + 1}. **Target Text**: "${c.anchorText}"`);
      if (c.contextBefore) {
        lines.push(`   *Context*: "...${c.contextBefore.trim()}..."`);
      }
      lines.push(`   *Feedback*: ${c.commentText}`);
      lines.push(``);
    });
  } else if (!diff.hasChanges && (!overallComment || !overallComment.trim()) && (!lockedTexts || lockedTexts.length === 0)) {
    lines.push(`*Note: Reviewer requested revisions without specific inline notes.*`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`### Next Steps for Agent:`);
  lines.push(`1. Inspect the updated file at \`${filePath}\` (contains the reviewer's direct edits).`);
  if (lockedTexts && lockedTexts.length > 0) {
    lines.push(`2. Ensure all 🔒 Locked Text Segments (${lockedTexts.length} segment${lockedTexts.length > 1 ? 's' : ''}) remain unchanged word-for-word.`);
  }
  if (inlineComments && inlineComments.length > 0) {
    lines.push(`${lockedTexts && lockedTexts.length > 0 ? '3' : '2'}. Address each of the ${inlineComments.length} inline comment(s) above.`);
  }
  if (overallComment && overallComment.trim()) {
    const num = (lockedTexts && lockedTexts.length > 0 ? 1 : 0) + (inlineComments && inlineComments.length > 0 ? 1 : 0) + 2;
    lines.push(`${num}. Incorporate the overall directive into your revision.`);
  }
  const nextNum = (lockedTexts && lockedTexts.length > 0 ? 1 : 0) + (inlineComments && inlineComments.length > 0 ? 1 : 0) + (overallComment && overallComment.trim() ? 1 : 0) + 2;
  lines.push(`${nextNum}. Save your updated draft to \`${filePath}\`.`);
  lines.push(`${nextNum + 1}. Execute \`pujangga review "${filePath}"\` to present Round ${roundNumber + 1} for review.`);

  return lines.join('\n');
}
