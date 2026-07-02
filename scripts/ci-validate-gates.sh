#!/usr/bin/env bash
# Pattern/registry validation gates — shared by validate-patterns.yml and daily-triage.yml
set -euo pipefail

echo "Patterns declared in registry:"
grep '^\s*-\s*id:' patterns/registry.yaml | sed 's/.*id: //' | sort > /tmp/registry.txt
echo "Pattern markdown files:"
ls patterns/*.md | xargs -n1 basename | sed 's/.md$//' | grep -v README | sort > /tmp/files.txt
echo "=== Registry ==="; cat /tmp/registry.txt
echo "=== Files ==="; cat /tmp/files.txt
comm -23 /tmp/files.txt /tmp/registry.txt | grep . && (echo "ERROR: pattern md file(s) missing from registry.yaml"; exit 1) || echo "All pattern files registered ✓"
comm -23 /tmp/registry.txt /tmp/files.txt | grep . && (echo "ERROR: registry entry without matching .md"; exit 1) || echo "No orphan registry entries ✓"

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

cd tools/loop-init
npm ci
npm test

echo "Building and testing loop-sync…"
cd ../loop-sync
npm ci
npm test

echo "Building and testing loop-context…"
cd ../loop-context
npm ci
npm test

echo "Building and testing mcp-server…"
cd ../mcp-server
npm ci
npm test

echo "validate gates passed ✓"