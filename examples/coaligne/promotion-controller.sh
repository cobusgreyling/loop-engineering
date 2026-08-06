#!/usr/bin/env bash
set -euo pipefail

evidence_dir="${1:?usage: promotion-controller.sh <evidence-directory>}"
auto_merge="${LOOP_AUTO_MERGE:-false}"
repository="${LOOP_REPOSITORY:-}"
engine_root="${LOOP_ENGINE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
contract_file="${LOOP_PROMOTION_CONTRACT:-$engine_root/examples/coaligne/promotion.yaml}"
gate_file="${LOOP_GATE_FILE:-$engine_root/examples/coaligne/gate.yaml}"

shopt -s nullglob
evidence_files=("$evidence_dir"/*.json)
if [ "${#evidence_files[@]}" -eq 0 ]; then
  echo "No promotion evidence found; early exit."
  exit 0
fi

for evidence_file in "${evidence_files[@]}"; do
  decision_file="$(mktemp "${TMPDIR:-/tmp}/loop-promotion-decision.XXXXXX")"
  cleanup() { rm -f "$decision_file" "$decision_file.stage"; }
  trap cleanup EXIT

  set +e
  node "$engine_root/tools/loop-gate/dist/cli.js" promote \
    --contract "$contract_file" \
    --gate-file "$gate_file" \
    --evidence "$evidence_file" \
    --json > "$decision_file"
  gate_code=$?
  set -e

  if [ "$gate_code" -eq 2 ]; then
    node -e '
      const fs = require("fs");
      const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      console.log(`HOLD PR #${d.pullRequest} @ ${d.headSha} [${d.stage}]`);
      for (const i of d.issues) console.log(`  - ${i.kind} ${i.code}: ${i.message}`);
      const trigger = d.issues.some((i) => i.code === "deployment-missing") ? "trigger" : "wait";
      process.stderr.write(`${d.pullRequest} ${d.headSha} ${d.stage} ${trigger}\n`);
    ' "$decision_file" 2>"$decision_file.stage"
    read -r hold_pr hold_sha hold_stage deployment_action < "$decision_file.stage"
    rm -f "$decision_file.stage"
    if [ "$hold_stage" = "deployment" ] && [ "$deployment_action" = "trigger" ]; then
      trigger_args=(
        --repository "${repository:?LOOP_REPOSITORY is required to trigger deployment}"
        --pr "$hold_pr"
        --sha "$hold_sha"
        --environment coaligne-test
      )
      if [ -z "${DRONE_SERVER:-}" ] || [ -z "${DRONE_TOKEN:-}" ]; then
        echo "  deployment trigger not configured: set DRONE_SERVER and DRONE_TOKEN."
      else
        if [ "${LOOP_TRIGGER_DEPLOYMENT:-false}" = "true" ]; then
          trigger_args+=(--execute)
        fi
        node "$engine_root/examples/coaligne/trigger-drone-promotion.mjs" "${trigger_args[@]}"
      fi
    fi
    cleanup
    trap - EXIT
    continue
  fi
  if [ "$gate_code" -ne 0 ]; then
    cat "$decision_file" >&2
    exit "$gate_code"
  fi

  read -r pr_number head_sha < <(
    node -e '
      const fs = require("fs");
      const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.stdout.write(`${d.pullRequest} ${d.headSha}\n`);
    ' "$decision_file"
  )
  echo "MERGE-READY PR #${pr_number} @ ${head_sha}"

  if [ "$auto_merge" != "true" ]; then
    echo "  dry-run: set LOOP_AUTO_MERGE=true to execute the compare-and-swap merge."
    cleanup
    trap - EXIT
    continue
  fi

  gh_args=(pr view "$pr_number" --json headRefOid,state,isDraft,mergeStateStatus)
  merge_args=(pr merge "$pr_number" --squash --delete-branch --match-head-commit "$head_sha")
  if [ -n "$repository" ]; then
    gh_args+=(--repo "$repository")
    merge_args+=(--repo "$repository")
  fi
  current="$(gh "${gh_args[@]}")"
  node -e '
    const current = JSON.parse(process.argv[1]);
    const expected = process.argv[2];
    if (current.headRefOid !== expected) throw new Error(`HEAD changed: ${current.headRefOid} != ${expected}`);
    if (current.state !== "OPEN" || current.isDraft || current.mergeStateStatus !== "CLEAN") {
      throw new Error(`PR is no longer mergeable: ${JSON.stringify(current)}`);
    }
  ' "$current" "$head_sha"

  # GitHub performs the final atomic head-SHA comparison as well.
  gh "${merge_args[@]}"
  cleanup
  trap - EXIT
done
