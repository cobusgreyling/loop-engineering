#!/usr/bin/env bash
set -euo pipefail

evidence_file="${1:-examples/coaligne/evidence/pr-ready.json}"

node tools/loop-gate/dist/cli.js promote \
  --contract examples/coaligne/promotion.yaml \
  --gate-file examples/coaligne/gate.yaml \
  --evidence "$evidence_file" \
  --json

# The engine deliberately does not hide the final side effect. A production
# controller should re-fetch the PR and use GitHub's head-SHA compare-and-swap:
# gh pr merge "$PR_NUMBER" --squash --delete-branch --match-head-commit "$HEAD_SHA"
