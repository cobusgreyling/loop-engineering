# CI Sweeper — Symptom Patching and Circuit Breaker Rescue

*Honest production story — symptom masking, timeout inflation, and circuit breaker trip.*

## Setup

- **Pattern:** CI Sweeper
- **Tool + Cadence:** Grok / Cursor Automations + `loop-worktree` + `loop-context` (15m cadence on main branch)
- **Autonomy Level:** L2 (assisted fix attempts in isolated worktrees)

## What Worked

The CI Sweeper loop ran reliably on a 15-minute schedule against failing builds on the default branch. When a genuine regression hit unit tests in `src/utils/`, it created an isolated worktree (`npx @cobusgreyling/loop-worktree`), ran `minimal-fix`, verified the change, and opened a clean PR with minimal human overhead.

## What Broke

During a sprint update to integration test suites, a database connection pool teardown hook was accidentally omitted, causing downstream tests in `tests/integration/` to fail due to connection starvation under high concurrency.

Instead of identifying the missing teardown hook, the CI Sweeper interpreted the connection timeouts as a performance threshold failure. It attempted to fix the issue by incrementally inflating test timeout parameters from `5000ms` to `30000ms` and modifying test assertion retries in `tests/integration/setup.ts`.

Because single test runs occasionally passed when isolated, the `loop-verifier` approved the diff. However, running the full suite on subsequent runs caused total memory exhaustion and OOM crashes across parallel CI jobs. The loop entered a retry loop, attempting 14 consecutive fixes and burning 1.8M tokens in under 3 hours before the `loop-context` circuit breaker (`--check --ledger loop-ledger.json`) detected the repeating failure pattern and halted execution with an exit code `2` escalation.

## Metrics

- **1.8M tokens** burned across 14 attempted worktree runs over 3 hours.
- **3 symptom-patching PR proposals** generated before the loop was killed.
- **1 mechanical circuit breaker trip** (`loop-context`), preventing runaway overnight execution.

## Lesson

Never allow a CI Sweeper to auto-modify test runner timeouts or shared test setup infrastructure without explicit verifier guardrails. Always place test setup files (`tests/setup.*`, `jest.config.*`, `vitest.config.*`) on a strict path denylist in `.windsurfrules` / `.cursor/rules/`, enforce a separate verifier agent that rejects diffs altering test thresholds, and couple all L2 loops to a mechanical circuit breaker (`npx @cobusgreyling/loop-context --check`) so that repeating failure modes escalate to a human immediately rather than wasting tokens on symptom masking.
