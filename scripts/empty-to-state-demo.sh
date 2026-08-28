#!/usr/bin/env bash
# Empty directory → scaffolded Daily Triage → first STATE.md.
# Run from the loop-engineering repo root. Does not publish or push.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INIT="$ROOT/tools/loop-init/dist/cli.js"
AUDIT="$ROOT/tools/loop-audit/dist/cli.js"

if [[ ! -f "$INIT" ]]; then
  echo "Build loop-init first: (cd tools/loop-init && npm test)" >&2
  exit 1
fi
if [[ ! -f "$AUDIT" ]]; then
  echo "Build loop-audit first: (cd tools/loop-audit && npm test)" >&2
  exit 1
fi

DIR="$(mktemp -d "${TMPDIR:-/tmp}/empty-to-state.XXXXXX")"
cleanup() { rm -rf "$DIR"; }
trap cleanup EXIT

echo "== 1. Empty git repo in $DIR"
git -C "$DIR" init -q
git -C "$DIR" config user.email "demo@loop.engineering"
git -C "$DIR" config user.name "Loop Demo"

echo "== 2. Scaffold Daily Triage (default tool is claude)"
node "$INIT" "$DIR" --pattern daily-triage --tool claude

echo
echo "== 3. Loop Ready (files only — no run yet)"
node "$AUDIT" "$DIR" || true

echo
echo "== 4. First STATE.md (before a real run)"
sed -n '1,20p' "$DIR/STATE.md"

echo
echo "== 5. Simulate one L1 run (what /loop writes)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$DIR/STATE.md" "$TS" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
ts = sys.argv[2]
text = p.read_text()
text = text.replace("Last run: never", f"Last run: {ts} (empty-to-state demo)", 1) if "Last run: never" in text else (
    f"# Loop State\n\nLast run: {ts} (empty-to-state demo)\n\n## High Priority\n\n- Demo item: read this file tomorrow. Do not auto-fix.\n\n## Watch List\n"
    if "Last run:" not in text else
    __import__("re").sub(r"Last run:.*", f"Last run: {ts} (empty-to-state demo)", text, count=1)
)
if "## High Priority" in text and "Demo item:" not in text:
    text = text.replace("## High Priority", "## High Priority\n\n- Demo item: read this file tomorrow. Do not auto-fix.", 1)
p.write_text(text)
PY

git -C "$DIR" add STATE.md LOOP.md
git -C "$DIR" commit -qm "chore(loop): first L1 daily triage [demo]"

echo
echo "== 6. Loop Ready after one dated run + commit"
node "$AUDIT" "$DIR" || true

echo
echo "Done. That is the 10-minute path: init → doctor → one report-only run → commit STATE.md."
echo "Camera script: docs/distribution/empty-to-state-video.md"
echo "(temp dir removed on exit)"
