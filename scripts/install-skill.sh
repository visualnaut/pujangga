#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Installing Pujangga Skill ==="

# 1. Build project
echo "Building Pujangga assets and binaries..."
cd "$REPO_DIR"
pnpm build

# 2. Link CLI binary to user's bin if available
TARGET_BIN_DIR="$HOME/.local/bin"
if [ ! -d "$TARGET_BIN_DIR" ]; then
  mkdir -p "$TARGET_BIN_DIR"
fi

ln -sf "$REPO_DIR/bin/pujangga" "$TARGET_BIN_DIR/pujangga"
echo "✓ Symlinked CLI to $TARGET_BIN_DIR/pujangga"

# 3. Install to Gemini Antigravity skills directory
GEMINI_SKILLS_DIR="$HOME/.gemini/config/skills/pujangga"
mkdir -p "$GEMINI_SKILLS_DIR"
cp "$REPO_DIR/SKILL.md" "$GEMINI_SKILLS_DIR/SKILL.md"
echo "✓ Installed skill to $GEMINI_SKILLS_DIR/SKILL.md"

# 4. Install to Claude Code skills directory if available
CLAUDE_SKILLS_DIR="$HOME/.claude/skills/pujangga"
if [ -d "$HOME/.claude/skills" ]; then
  mkdir -p "$CLAUDE_SKILLS_DIR"
  cp "$REPO_DIR/SKILL.md" "$CLAUDE_SKILLS_DIR/SKILL.md"
  echo "✓ Installed skill to $CLAUDE_SKILLS_DIR/SKILL.md"
fi

echo "=== Installation Complete! ==="
echo "You can now run 'pujangga review <filepath>' or instruct any agent with /pujangga."
