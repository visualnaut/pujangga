# 🖋️ Pujangga

> **Pujangga** (*Indonesian/Malay: poet, author, man of letters*) — An editorial-grade, harness-agnostic writing review surface for human-in-the-loop AI generation.

[![Node.js](https://img.shields.io/badge/Node.js-24%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🌟 Why Pujangga?

AI agents write drafts quickly, but reviewing long-form prose inside terminal windows or chat bubbles is clumsy:
- You cannot easily leave inline feedback on a specific phrase or sentence.
- You cannot make quick in-place editorial tweaks without copying back and forth.
- Multi-round revision loops lose context between iterations.

**Pujangga** bridges the gap with a distraction-free, literary web canvas. An AI agent invokes `pujangga review <filepath>`, and Pujangga launches a persistent local review tab where you can:
1. **Highlight text to attach inline critique pins** (`📌`).
2. **Directly edit the draft in-place** in a Notion/Google Docs-style WYSIWYG editor.
3. **Compare revision diffs** between consecutive agent rounds.
4. **Audit resolved comments** from previous iterations.
5. **Request revisions or approve with one click**, automatically returning structured Markdown directives to the agent.

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/visualnaut/pujangga.git
cd pujangga

# Install dependencies and build
pnpm install
pnpm build

# Link CLI and install the skill for Gemini / Claude / Cursor agents
./scripts/install-skill.sh
```

### Reviewing a Document

From any project folder:
```bash
pujangga review path/to/draft.md
```

- Pujangga starts a lightweight background daemon (stored in `~/.pujangga/`).
- Your default browser opens to the live review surface.
- The terminal blocks waiting for your submission.
- When you click **Request Revision**, the file on disk is updated with your edits, and the agent receives a structured Markdown feedback report on stdout.
- When you click **Satisfied ✨**, the review terminates with status `SATISFIED`.

---

## 🤖 Harness-Agnostic Skill Integration

Pujangga works with **any** agent harness (Claude Code, Gemini Antigravity, Cursor, Roo Code, Aider, etc.) that can execute terminal commands.

To equip your agent with Pujangga, point it to [`SKILL.md`](./SKILL.md) or install it to your user skills folder:
- **Gemini Antigravity**: `~/.gemini/config/skills/pujangga/SKILL.md`
- **Claude Code**: `~/.claude/skills/pujangga/SKILL.md`

### Example Agent Loop

```markdown
Agent writes initial draft -> calls `pujangga review draft.md` -> 
human submits comments -> agent reads stdout report ->
agent revises draft.md -> calls `pujangga review draft.md` ->
human marks Satisfied -> loop completes.
```

---

## 🛠️ Architecture

- **Backend**: Node.js 24 with native `node:sqlite`, HTTP/WebSocket server (`ws`), long-polling wait loop.
- **Frontend**: React 19, Tiptap WYSIWYG editor with Markdown roundtripping, Tailwind CSS v4, Lucide icons.
- **Diff Engine**: JSDiff token and word-level diffing.
- **Storage**: Centralized in `~/.pujangga/pujangga.db`, preventing repo clutter.

---

## 📜 CLI Reference

| Command | Description |
| :--- | :--- |
| `pujangga review <file>` | Submit or resume a document review in the browser |
| `pujangga review <file> --no-open` | Register review session without auto-opening the browser |
| `pujangga status` | View daemon PID, port, uptime, and active sessions |
| `pujangga stop` | Gracefully stop the background daemon |

---

## ⚖️ License

MIT
