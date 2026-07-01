#!/usr/bin/env bash
# Idempotent backlog bootstrap. Skips issues that already exist by title.
set -euo pipefail

REPO="cobusgreyling/loop-engineering"
BODY_DIR="$(cd "$(dirname "$0")/issue-bodies" && pwd)"

create_issue() {
  local title="$1"
  local labels="$2"
  local body_file="$3"

  if gh issue list --repo "$REPO" --search "in:title \"${title}\"" --state all --json title --jq '.[].title' | grep -Fxq "$title"; then
    echo "SKIP (exists): $title"
    gh issue list --repo "$REPO" --search "in:title \"${title}\"" --state open --json number,url --jq '.[0] | "#\(.number) \(.url)"'
    return
  fi

  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body-file "$body_file"
}

create_issue "Add Cursor daily-triage example" "good first issue,docs" "$BODY_DIR/cursor-daily-triage.md"
create_issue "Add Windsurf daily-triage example" "good first issue,docs" "$BODY_DIR/windsurf-daily-triage.md"
create_issue "Add Cursor and Windsurf columns to examples pattern table" "good first issue,docs" "$BODY_DIR/examples-cursor-windsurf-columns.md"
create_issue "Expand Aider appendix in primitives-matrix" "good first issue,docs" "$BODY_DIR/aider-appendix.md"
create_issue "Add Continue.dev row to primitives matrix" "good first issue,docs" "$BODY_DIR/continue-dev-matrix.md"
create_issue "Share your week-one Daily Triage story" "good first issue,story" "$BODY_DIR/daily-triage-story.md"
create_issue "Share a PR Babysitter failure story" "good first issue,story" "$BODY_DIR/pr-babysitter-story.md"
create_issue "Add your project to the adopters list" "good first issue,docs" "$BODY_DIR/adopters-row.md"
create_issue "Clarify loop-init --tool values in QUICKSTART cheat sheet" "good first issue,docs" "$BODY_DIR/quickstart-tool-values.md"
create_issue "Add loop-triage constraints example for Cursor" "good first issue,docs" "$BODY_DIR/cursor-constraints.md"

echo "Done. Open backlog:"
echo "https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"