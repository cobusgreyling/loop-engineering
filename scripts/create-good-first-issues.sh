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
create_issue "Add Hermes to examples README copy-paste starters table" "good first issue,docs" "$BODY_DIR/hermes-copy-paste-starters.md"
create_issue "Add Hermes section to QUICKSTART" "good first issue,docs" "$BODY_DIR/hermes-quickstart.md"
create_issue "Add examples/hermes/README.md index" "good first issue,docs" "$BODY_DIR/hermes-readme-index.md"
create_issue "Add Windsurf PR Babysitter example doc" "good first issue,docs" "$BODY_DIR/windsurf-pr-babysitter-example.md"
create_issue "Share a Post-Merge Cleanup production story" "good first issue,story" "$BODY_DIR/post-merge-cleanup-story.md"

# Wave 2 — refresh backlog after Jul 2026 merges (idempotent; skips existing titles)
create_issue "Add loop-context subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-loop-context.md"
create_issue "Add loop-mcp-server subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-mcp-server.md"
create_issue "Link Aider appendix from examples README" "good first issue,docs" "$BODY_DIR/examples-aider-link.md"
create_issue "Add Hermes to examples README tool directory" "good first issue,docs" "$BODY_DIR/hermes-examples-readme.md"
create_issue "Share an Issue Triage week-one story" "good first issue,story" "$BODY_DIR/issue-triage-story.md"
create_issue "Add Opencode constraints example doc" "good first issue,docs" "$BODY_DIR/opencode-constraints-example.md"
create_issue "Share a multi-loop coordination story" "good first issue,story" "$BODY_DIR/multi-loop-story.md"

# Wave 3 — example gaps, QUICKSTART tools, community stories (Jul 2026)
create_issue "Add Cursor CI Sweeper example doc" "good first issue,docs" "$BODY_DIR/cursor-ci-sweeper-example.md"
create_issue "Add Cursor Post-Merge Cleanup example doc" "good first issue,docs" "$BODY_DIR/cursor-post-merge-cleanup-example.md"
create_issue "Add Cursor Dependency Sweeper example doc" "good first issue,docs" "$BODY_DIR/cursor-dependency-sweeper-example.md"
create_issue "Add Cursor Changelog Drafter example doc" "good first issue,docs" "$BODY_DIR/cursor-changelog-drafter-example.md"
create_issue "Add Cursor Issue Triage example doc" "good first issue,docs" "$BODY_DIR/cursor-issue-triage-example.md"
create_issue "Add Hermes PR Babysitter example doc" "good first issue,docs" "$BODY_DIR/hermes-pr-babysitter-example.md"
create_issue "Add loop-sync subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-loop-sync.md"
create_issue "Add Amazon Q appendix to primitives matrix" "good first issue,docs" "$BODY_DIR/amazon-q-appendix.md"
create_issue "Add Codeium appendix to primitives matrix" "good first issue,docs" "$BODY_DIR/codeium-appendix.md"
create_issue "Share your loop-worktree week-two story" "good first issue,story" "$BODY_DIR/loop-worktree-week-two-story.md"
create_issue "Share your multi-loop failure story" "good first issue,story" "$BODY_DIR/multi-loop-failure-story.md"
create_issue "Add loop-init validation checklist doc" "good first issue,docs" "$BODY_DIR/loop-init-validation-checklist.md"

# Wave 4 — coverage gaps after Jul 2026 merges (Hermes/Windsurf, new tools, stories)
create_issue "Add Windsurf CI Sweeper example doc" "good first issue,docs" "$BODY_DIR/windsurf-ci-sweeper-example.md"
create_issue "Add Windsurf Issue Triage example doc" "good first issue,docs" "$BODY_DIR/windsurf-issue-triage-example.md"
create_issue "Add Windsurf Dependency Sweeper example doc" "good first issue,docs" "$BODY_DIR/windsurf-dependency-sweeper-example.md"
create_issue "Add Hermes CI Sweeper example doc" "good first issue,docs" "$BODY_DIR/hermes-ci-sweeper-example.md"
create_issue "Add Hermes Issue Triage example doc" "good first issue,docs" "$BODY_DIR/hermes-issue-triage-example.md"
create_issue "Add loop-action subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-loop-action.md"
create_issue "Add loop-sandbox subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-loop-sandbox.md"
create_issue "Add loop-gate subsection to QUICKSTART" "good first issue,docs" "$BODY_DIR/quickstart-loop-gate.md"
create_issue "Share a CI Sweeper production story" "good first issue,story" "$BODY_DIR/ci-sweeper-story.md"
create_issue "Share a Changelog Drafter week-one story" "good first issue,story" "$BODY_DIR/changelog-drafter-story.md"
create_issue "Harden loop-action command invocation (safe quoting)" "good first issue,tooling" "$BODY_DIR/harden-loop-action-command.md"

echo "Done. Open backlog:"
echo "https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"