#!/usr/bin/env bash
# Pattern/registry validation gates — shared by validate-patterns.yml and daily-triage.yml
set -euo pipefail

VALIDATE_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/loop-engineering-validate.XXXXXX")"
trap 'rm -rf "$VALIDATE_TMP_DIR"' EXIT
REGISTRY_FILE="$VALIDATE_TMP_DIR/registry.txt"
PATTERN_FILES="$VALIDATE_TMP_DIR/files.txt"

echo "Patterns declared in registry:"
grep '^\s*-\s*id:' patterns/registry.yaml | sed 's/.*id: //' | sort > "$REGISTRY_FILE"
echo "Pattern markdown files:"
ls patterns/*.md | xargs -n1 basename | sed 's/.md$//' | grep -v README | sort > "$PATTERN_FILES"
echo "=== Registry ==="; cat "$REGISTRY_FILE"
echo "=== Files ==="; cat "$PATTERN_FILES"
comm -23 "$PATTERN_FILES" "$REGISTRY_FILE" | grep . && (echo "ERROR: pattern md file(s) missing from registry.yaml"; exit 1) || echo "All pattern files registered ✓"
comm -23 "$REGISTRY_FILE" "$PATTERN_FILES" | grep . && (echo "ERROR: registry entry without matching .md"; exit 1) || echo "No orphan registry entries ✓"

echo "Checking that key sections exist in patterns (lightweight)"
for f in patterns/*.md; do
  if [[ "$f" == *"README.md" ]]; then continue; fi
  grep -q "^## Scheduling" "$f" || { echo "Missing Scheduling in $f"; exit 1; }
  grep -q "^## Required Skills" "$f" || { echo "Missing Required Skills in $f"; exit 1; }
  grep -Eq "maker.*checker|verifier|Maker / Checker|Verification Strategy|reviewer sub-agent" "$f" || { echo "Missing verifier strategy (maker/checker) mention in $f"; exit 1; }
done
echo "Basic pattern structure checks passed ✓"

test -f templates/pattern-template.md || (echo "Missing pattern-template.md"; exit 1)
test -f templates/STATE.md.template || (echo "Missing STATE template"; exit 1)
test -f templates/loop-run-log.md.template || (echo "Missing loop-run-log template"; exit 1)
test -f templates/loop-budget.md.template || (echo "Missing loop-budget template"; exit 1)
echo "Templates present ✓"

npm install --no-save yaml@2 ajv@8
node scripts/validate-registry.mjs
node scripts/check-loop-init-sync.mjs

echo "Building and testing readiness-core…"
(
  cd tools/readiness-core
  npm ci
  npm test
)

echo "Building and testing loop-audit…"
(
  cd tools/loop-audit
  npm ci
  npm test
)

echo "Building and testing goal-audit…"
(
  cd tools/goal-audit
  npm ci
  npm test
)

echo "Building and testing loop-init…"
(
  cd tools/loop-init
  # Always install monorepo sibling so CI/publish order does not require npm
  # to already have the new loop-audit version (chicken-and-egg with ^1.7.0).
  echo "Installing monorepo loop-audit sibling for loop-init"
  cp package.json package.json.ci-bak
  cp package-lock.json package-lock.json.ci-bak
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    p.dependencies['@cobusgreyling/loop-audit'] = 'file:../loop-audit';
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  npm install
  # Restore published package metadata (do not leave file: deps in package.json)
  mv package.json.ci-bak package.json
  mv package-lock.json.ci-bak package-lock.json
  npm test
)

echo "Building and testing loop-sync…"
cd tools/loop-sync
npm ci
npm test

echo "Building and testing goal-init…"
cd ../goal-init
npm ci
npm test

echo "Building and testing loop-context…"
cd ../loop-context
npm ci
npm test

echo "Building and testing loop-gate…"
cd ../loop-gate
npm ci
npm test

echo "Building and testing mcp-server…"
cd ../mcp-server
npm ci
npm test

echo "validate gates passed ✓"
