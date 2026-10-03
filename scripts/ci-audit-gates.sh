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

# Umbrella CLI dogfood (additive — does not replace loop-audit gates)
echo "=== loop doctor (umbrella front door) ==="
(
  cd "$REPO_ROOT/tools/loop-sync"
  npm ci
  npm run build
)
(
  cd "$REPO_ROOT/tools/loop"
  npm ci
  npm test
  # Reference repo should not be blocked (exit 2). Warnings (exit 1) are OK.
  set +e
  node dist/cli.js doctor "$REPO_ROOT" --json > "$AUDIT_TMP_DIR/doctor.json"
  DOCTOR_CODE=$?
  set -e
  if [ "$DOCTOR_CODE" -ge 2 ]; then
    echo "loop doctor blocked (exit $DOCTOR_CODE) on reference repo"
    cat "$AUDIT_TMP_DIR/doctor.json" || true
    exit 2
  fi
  echo "loop doctor exit=$DOCTOR_CODE (0=healthy, 1=warning OK for dogfood)"
  node dist/cli.js status "$REPO_ROOT" --json > /dev/null
)

echo ""
echo "=== Audit of starters (L1 gate) ==="
FAILED=0
for s in "$REPO_ROOT"/starters/*/; do
  NAME=$(basename "$s")
  # Thin loop is intentionally file-light (tracker is the state). Loop-audit
  # exits 2 below score 40; do not hold it to the L1 file-score gate.
  if [[ "$NAME" == "thin-loop" ]]; then
    echo "--- ${NAME}: skipped L1 file-score gate (by design)"
    continue
  fi
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
  // loop-drill.json is the proof loop-audit scores L3 on. ci-validate-gates.sh
  // re-runs the drills, so a committed record cannot claim more than they show;
  // this catches a gate.yaml edited without re-recording.
  const proof = data.signals.proof || {};
  const problems = [];
  if (!proof.present) problems.push("loop-drill.json is missing");
  if (proof.error) problems.push("loop-drill.json is unreadable: " + proof.error);
  if ((proof.stale || []).length) problems.push("stale for " + proof.stale.join(", "));
  if ((proof.failed || []).length) problems.push("failing: " + proof.failures.join(", "));
  if (!problems.length && !(proof.proven || []).includes("gate")) problems.push("gate is not proven");
  if (problems.length) {
    console.error("Reference guardrails are not proven (" + problems.join("; ") + ").");
    console.error("Re-record from the repo root: (cd tools/loop-drill && npm ci && npm run build) && node tools/loop-drill/dist/cli.js . --record");
    process.exit(2);
  }
  console.log("Reference guardrails proven: " + proof.proven.join(", "));
'

if [[ -n "${LOOP_AUDIT_OUTPUT_FILE:-}" ]]; then
  cp "$ROOT_AUDIT_FILE" "$LOOP_AUDIT_OUTPUT_FILE"
fi

echo "audit gates passed ✓"
