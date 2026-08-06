# coAligne — evidence-aware PR promotion loop

This demo turns the coAligne test-deployment requirements into an executable
merge contract. It is deliberately stricter than "CI is green".

## What the engine proves

Before returning `MERGE-READY`, `loop-gate promote` proves that the **current PR
HEAD SHA** has:

1. maintainer authorization and an approval for that same SHA;
2. a known clean merge state and no unresolved review thread;
3. the required Drone check;
4. a successful deployment to `coaligne-test`;
5. a successful reset/seed using versioned synthetic or sanitized data;
6. baseline and changed-path-specific E2E suites using that dataset version;
7. manual acceptance for high/critical risk changes;
8. compliance with the static path denylist and auto-merge allowlist.

Any new commit invalidates approval, check, deployment, dataset, E2E, and
acceptance evidence because those records no longer match the HEAD SHA.

## Run the deterministic demo

```bash
cd tools/loop-gate && npm ci && npm test && cd ../..

# Ready evidence exits 0.
bash examples/coaligne/run-promotion.sh \
  examples/coaligne/evidence/pr-ready.json

# Evidence from an older SHA exits 2 and explains every missing gate.
bash examples/coaligne/run-promotion.sh \
  examples/coaligne/evidence/pr-new-commit.json
```

## Runtime architecture

Use GitHub/Drone webhooks for immediate work and a six-hour scheduled run as a
reconciler:

```text
PR event / review / check / deployment event ─┐
                                              ├─ collect trusted evidence
cron: 0 */6 * * * ────────────────────────────┘
                                                     │
                                                     ▼
                                            loop gate promote
                                              │            │
                                           HOLD       MERGE-READY
                                              │            │
                                     fix/escalate     re-fetch HEAD
                                                           │
                                                           ▼
                                              gh pr merge --match-head-commit
```

The evidence collector is environment-specific. It must be trusted code from
the default branch, not code from the PR being evaluated. coAligne should map:

- Drone `continuous-integration/drone/pr` status → `checks[]`;
- test deployment receipt (environment + commit) → `deployment`;
- reset/seed receipt (classification + immutable version) → `testData`;
- E2E runner receipts → `e2e[]`;
- maintainer acceptance receipt → `manualAcceptance`.

Webhook payloads are wakeup hints only. The default-branch controller re-fetches
every receipt from GitHub and Drone instead of trusting evidence embedded in a
`repository_dispatch` payload.

The included [`collect-promotion-evidence.mjs`](./collect-promotion-evidence.mjs)
is a working GitHub adapter. It collects changed paths, exact-head approvals,
review threads, mergeability, status/check runs (including Drone commit
statuses), risk/attempt labels, and GitHub Deployment receipts. It deliberately
converts exact-head `loop/test-data/coaligne-acceptance-v1` and `loop/e2e/*`
statuses from the protected test runner into gate receipts. For risk levels that
require a human, an allowed maintainer comments `/loop accept <full-head-sha>` on
the PR; the collector records the comment author and timestamp. Missing, stale,
wrong-SHA, or unauthorized records remain missing evidence and are never inferred
from a green CI result.

```bash
node examples/coaligne/collect-promotion-evidence.mjs \
  --repository dataelement/coAligne \
  --output .loop/evidence \
  --receipt-actor coaligne-loop-bot \
  --ci-actor drone-ci \
  --acceptance-actors maintainer-one,maintainer-two \
  --all-open
```

[`pr-promotion-loop.yml`](./pr-promotion-loop.yml) shows both trigger paths.
[`promotion-controller.sh`](./promotion-controller.sh) evaluates all receipts,
holds incomplete PRs without failing the whole sweep, and—only when
`LOOP_AUTO_MERGE=true`—re-fetches GitHub state before using
`--match-head-commit` for an atomic squash merge. The default is dry-run.
The controller resolves its files relative to its own checkout, so an adopting
repository can check this engine out at a reviewed, immutable commit and set
`LOOP_ENGINE_ROOT` instead of copying executable controller code into every
application repository.

Do not accept an evidence JSON committed by the PR author: that would let the
change approve itself. Store receipts in GitHub Checks/Deployments, Drone, or a
separate trusted evidence store, then generate the JSON in the controller.

## coAligne adoption

The coAligne adoption branch adds a serialized Drone `promote` pipeline targeting
`coaligne-test`. The controller promotes a successful **main-branch** build and
passes the candidate SHA as `LOOP_REVISION`; therefore the pipeline definition,
test harness, and receipt publisher come from trusted main rather than from the
PR. The pipeline separately checks out that candidate, deploys it, exposes its
revision from the running API, seeds the immutable `coaligne-acceptance-v1`
synthetic dataset, and runs black-box multi-user acceptance. The flow covers
login, private-project authorization, project membership, file sync, workspace
merge, file readback, comments, notifications, and cleanup. Only after all of
those pass does trusted tooling publish exact-SHA GitHub deployment and `loop/*`
status receipts.

To activate it, configure:

1. Drone secrets `TEST_DEPLOY_ENV`, `TEST_DEPLOY_HOST`, `TEST_DEPLOY_USER`,
   `TEST_DEPLOY_SSH_KEY`, and a pinned `TEST_DEPLOY_KNOWN_HOSTS` entry;
2. `LOOP_ACCEPTANCE_PASSWORD`, `LOOP_TEST_API_URL`, and `LOOP_TEST_WEB_URL`;
3. a least-privilege `LOOP_GITHUB_TOKEN` that can publish commit statuses and
   deployments, restricted to the protected promotion pipeline;
4. controller variables `LOOP_RECEIPT_ACTOR`, `LOOP_CI_ACTOR`, and
   `LOOP_ACCEPTANCE_ACTORS` matching the GitHub identities permitted to issue
   those records;
5. a controller-side Drone promotion trigger after intake/review/check gates pass.

Never expose promotion secrets to ordinary pull-request pipelines. The contract
requires same-repository PRs and maintainer authorization, but the runner and
credentials must still be protected independently from PR-authored commands.
