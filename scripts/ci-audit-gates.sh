#!/usr/bin/env bash
# Loop readiness audit gates — shared by audit.yml and daily-triage.yml
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/tools/loop-audit"
npm ci
npm test
echo "=== Audit of repo root ==="
node dist/cli.js "$REPO_ROOT" --json > /tmp/root-audit.json
echo ""
echo "=== Audit of starters (L1 gate) ==="
FAILED=0
for s in "$REPO_ROOT"/starters/*/; do
  NAME=$(basename "$s")
  node dist/cli.js "$s" --json > "/tmp/starter-${NAME}.json"
  node -e "
    const data = JSON.parse(require('fs').readFileSync('/tmp/starter-${NAME}.json', 'utf8'));
    console.log('--- ${NAME}: score=' + data.score + ' level=' + data.level);
    if (data.score < 38) {
      console.error('Starter ${NAME} below L1 threshold (38): ' + data.score);
      process.exit(1);
    }
  " || FAILED=1
done
if [ "$FAILED" -ne 0 ]; then
  echo "One or more starters failed L1 gate"
  exit 1
fi
cp /tmp/root-audit.json /tmp/audit.json

node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync("/tmp/audit.json", "utf8"));
  console.log("Reference score: " + data.score);
  if (data.score < 58) {
    console.error("Reference score below L2 threshold (58). Restore dogfood signals: STATE.md, skills/, AGENTS.md.");
    process.exit(2);
  }
'
echo "audit gates passed ✓"