import * as diff from 'diff';

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffSummary {
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
  summaryText: string;
  unifiedDiff: string;
}

/**
 * Computes word-level diff parts for rendering additions and deletions in the UI.
 */
export function computeWordDiff(oldText: string, newText: string): DiffPart[] {
  return diff.diffWordsWithSpace(oldText, newText);
}

/**
 * Computes a clean unified diff and a concise summary for the agent report.
 */
export function summarizeDiff(oldText: string, newText: string, fileName: string = 'document.md'): DiffSummary {
  if (oldText === newText) {
    return {
      hasChanges: false,
      addedCount: 0,
      removedCount: 0,
      summaryText: 'No direct edits were made.',
      unifiedDiff: '',
    };
  }

  const patch = diff.createPatch(fileName, oldText, newText, 'Previous', 'Current');
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
    unifiedDiff: patch,
  };
}
