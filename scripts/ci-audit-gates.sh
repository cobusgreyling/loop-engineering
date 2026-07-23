#!/usr/bin/env bash
# Loop readiness audit gates — shared by audit.yml and daily-triage.yml
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/loop-engineering-audit.XXXXXX")"
trap 'rm -rf "$AUDIT_TMP_DIR"' EXIT
ROOT_AUDIT_FILE="$AUDIT_TMP_DIR/root-audit.json"

echo "Building readiness-core…"
(
  cd "$REPO_ROOT/tools/readiness-core"
  npm ci
  npm run build
)

cd "$REPO_ROOT/tools/loop-audit"
npm ci
npm test
echo "=== Audit of repo root ==="
node dist/cli.js "$REPO_ROOT" --json > "$ROOT_AUDIT_FILE"
echo ""
echo "=== Audit of starters (L1 gate) ==="
FAILED=0
for s in "$REPO_ROOT"/starters/*/; do
  NAME=$(basename "$s")
  STARTER_AUDIT_FILE="$AUDIT_TMP_DIR/starter-${NAME}.json"
  node dist/cli.js "$s" --json > "$STARTER_AUDIT_FILE"
  STARTER_AUDIT_FILE="$STARTER_AUDIT_FILE" STARTER_NAME="$NAME" node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.env.STARTER_AUDIT_FILE, "utf8"));
    console.log("--- " + process.env.STARTER_NAME + ": score=" + data.score + " level=" + data.level);
    if (data.score < 38) {
      console.error("Starter " + process.env.STARTER_NAME + " below L1 threshold (38): " + data.score);
      process.exit(1);
    }
  ' || FAILED=1
done
if [ "$FAILED" -ne 0 ]; then
  echo "One or more starters failed L1 gate"
  exit 1
fi

ROOT_AUDIT_FILE="$ROOT_AUDIT_FILE" node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(process.env.ROOT_AUDIT_FILE, "utf8"));
  console.log("Reference score: " + data.score);
  if (data.score < 58) {
    console.error("Reference score below L2 threshold (58). Restore dogfood signals: STATE.md, skills/, AGENTS.md.");
    process.exit(2);
  }
'

if [[ -n "${LOOP_AUDIT_OUTPUT_FILE:-}" ]]; then
  cp "$ROOT_AUDIT_FILE" "$LOOP_AUDIT_OUTPUT_FILE"
fi

echo "audit gates passed ✓"
