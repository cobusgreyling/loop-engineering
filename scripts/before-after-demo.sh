#!/usr/bin/env bash
# Demonstrates loop readiness scores: empty project → L1 starter → L2 (+ verifier).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT="$ROOT/tools/loop-audit/dist/cli.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ ! -f "$AUDIT" ]]; then
  echo "Building loop-audit..."
  (cd "$ROOT/tools/loop-audit" && npm ci --silent && npm run build --silent)
fi

score_bar() {
  local score="$1"
  local width=20
  local filled=$(( (score * width + 50) / 100 ))
  local bar=""
  local i
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=filled; i<width; i++)); do bar+="░"; done
  echo "$bar  ${score}/100"
}

run_audit() {
  local label="$1"
  local path="$2"
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "$label"
  echo "══════════════════════════════════════════════════"
  node "$AUDIT" "$path" || true
  local json
  json="$(node "$AUDIT" "$path" --json 2>/dev/null || true)"
  if [[ -n "$json" ]]; then
    local score level
    score="$(python3 -c "import json,sys; print(json.load(sys.stdin)['score'])" <<<"$json")"
    level="$(python3 -c "import json,sys; print(json.load(sys.stdin)['level'])" <<<"$json")"
    echo ""
    echo "▸ Loop Ready: ${score}/100 (${level})"
    score_bar "$score"
  fi
}

echo "Loop Readiness — before/after demo"
echo "Temp project: $TMP"

# Stage 0: empty directory
run_audit "Stage 0 — empty project (baseline)" "$TMP"

# Stage 1: copy Grok minimal-loop starter (L1)
mkdir -p "$TMP/.grok/skills"
cp -r "$ROOT/starters/minimal-loop/.grok/skills/loop-triage" "$TMP/.grok/skills/"
cp "$ROOT/starters/minimal-loop/STATE.md.example" "$TMP/STATE.md"
cp "$ROOT/starters/minimal-loop/LOOP.md" "$TMP/LOOP.md"
run_audit "Stage 1 — after minimal-loop starter (L1 report-only)" "$TMP"

# Stage 2: add verifier + AGENTS.md (L2)
mkdir -p "$TMP/.grok/skills/loop-verifier"
cp "$ROOT/templates/SKILL.md.verifier" "$TMP/.grok/skills/loop-verifier/SKILL.md"
cat > "$TMP/AGENTS.md" <<'EOF'
# AGENTS.md

## Test commands
npm test
npm run lint
EOF
run_audit "Stage 2 — after verifier + AGENTS.md (L2 assisted)" "$TMP"

echo ""
echo "Done. Copy a starter for your tool:"
echo "  Grok:        cp -r starters/minimal-loop/.grok/skills/loop-triage .grok/skills/"
echo "  Claude Code: cp -r starters/minimal-loop-claude/.claude/skills/loop-triage .claude/skills/"
echo "  Codex:       cp -r starters/minimal-loop-codex/.codex/skills/loop-triage .codex/skills/"
echo ""
echo "Audit your project: npx @cobusgreyling/loop-audit . --suggest"