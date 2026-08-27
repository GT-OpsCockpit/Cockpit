#!/usr/bin/env bash
# SessionStart hook: nudge a fresh machine to install the plugins this repo relies on.
set -euo pipefail

MP_DIR="$HOME/.claude/plugins/cache/claude-plugins-official/mattpocock-skills"
C7_DIR="$HOME/.claude/plugins/cache/claude-plugins-official/context7"

if [ -d "$MP_DIR" ] && [ -d "$C7_DIR" ]; then
  exit 0
fi

MSG=$(printf '%s\n' \
  '============================================================' \
  '  ACTION REQUISE avant de commencer a travailler ici' \
  '============================================================' \
  'Ce repo utilise deux extensions Claude Code pas encore' \
  'installees sur cette machine. Lance ces deux commandes' \
  'une seule fois, puis continue normalement :' \
  '' \
  '  claude plugin install mattpocock-skills@claude-plugins-official' \
  '  claude plugin install context7@claude-plugins-official' \
  '' \
  '(context7 fonctionne sans cle API, rien a configurer.)' \
  '============================================================')

jq -n --arg msg "$MSG" '{systemMessage: $msg, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $msg}}'
