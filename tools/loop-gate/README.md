# loop-gate

Mechanical enforcement for both static change policy and evidence-aware PR
promotion. It answers two different questions:

1. `check`: may this set of paths be committed or auto-merged?
2. `promote`: did the **current PR HEAD SHA** actually pass review, checks,
   deployment, approved-data seeding, E2E, and acceptance?

Deliberately has **no knowledge of run history**. Stagnation, repeated failures, and token/daily budgets already belong to [`loop-context`](../loop-context)'s circuit breaker — `loop-gate` only looks at *what* is being proposed (which paths, what action type), not *how the run has behaved so far*. Chain the two:

```bash
loop-context --check --ledger run.json ...            || exit 2   # run-history based
loop-gate check --action auto-merge --paths a.ts,b.ts  || exit 2   # policy based
do-the-merge
```

## Install & Run

```bash
npx @cobusgreyling/loop-gate check --action auto-merge --paths docs/guide.md
```

**From this repo:**

```bash
cd tools/loop-gate
npm install
npm test
```

## Usage

```bash
loop-gate check --action <commit|merge|auto-merge> --paths <f1,f2,...> [--gate-file gate.yaml] [--json]
loop-gate promote --contract promotion.yaml --evidence pr-42.json [--gate-file gate.yaml] [--json]
```

| Flag | Default | Meaning |
|------|---------|---------|
| `--action <commit\|merge\|auto-merge>` | required | What the loop is about to do |
| `--paths <f1,f2,...>` | required | Comma-separated changed file paths |
| `--gate-file <path>` | `gate.yaml` (cwd) | Policy file to evaluate against |
| `--json` | off | Machine-readable decision output |

Exit codes: `0` allowed · `2` escalate · `1` error (bad flags, missing/invalid config).

## Policy file

`gate.yaml` is the machine-readable twin of `docs/safety.md` — see [`templates/gate.yaml.template`](../../templates/gate.yaml.template) to scaffold your own, or this repo's own dogfood [`gate.yaml`](../../gate.yaml):

```yaml
version: 1
denylist:
  - ".env"
  - "**/secrets/**"
  - "auth/**"
maxFiles: 10
autoMergeAllowlist:
  - "docs/**"
  - "**/*.md"
```

Checked in order (first match wins, same "most specific trigger first" convention `loop-context`'s circuit breaker uses):

1. **`denylist`** — any changed path matching a glob here escalates, regardless of `--action`.
2. **`maxFiles`** — more changed paths than this escalates (matches `docs/safety.md`'s "Changes touching >N files" human gate).
3. **`autoMergeAllowlist`** — only checked when `--action auto-merge`; every changed path must match one of these globs, or it escalates.

Glob matching is via [`minimatch`](https://www.npmjs.com/package/minimatch) (the same semantics `.gitignore`-style globs use — `**` matches across path segments).

## Evidence-aware promotion

Copy [`templates/promotion.yaml.template`](../../templates/promotion.yaml.template)
to the target repository and adapt it. The controller supplies a trusted JSON
snapshot containing PR metadata and receipts from CI, deployment, test-data,
E2E, and human acceptance systems:

```bash
loop-gate promote \
  --contract promotion.yaml \
  --gate-file gate.yaml \
  --evidence .loop/evidence/pr-42.json \
  --json
```

Exit `0` means every gate is satisfied. Exit `2` means hold/escalate. The JSON
decision includes a stage and all unmet gates, so a reconciler can decide
whether to wait, dispatch a fix, request human action, or merge.

Core invariants:

- checks, approval, deployment, seeded data, E2E, and acceptance are tied to
  the current PR HEAD SHA;
- a new commit invalidates older evidence automatically;
- E2E suites may be activated by changed-path rules;
- production data can be forbidden while allowing versioned synthetic or
  sanitized datasets;
- static denylist/allowlist policy is evaluated in the same decision;
- the final merge should use the provider's compare-and-swap option, such as
  `gh pr merge --match-head-commit <sha>`.

See the executable [coAligne reference](../../examples/coaligne/README.md).

## What this does not do

- Does not read a run ledger — retry and budget behavior remains in
  `loop-context`. The evidence document carries only the current attempt count
  needed by the promotion contract.
- Does not trust or collect provider evidence by itself. A GitHub/Drone/etc.
  adapter must build the evidence document from trusted systems. Never accept
  evidence authored by the PR being evaluated.
- Does not produce its own escalation summary format — fold its JSON decision into whatever your control script already assembles from `loop-context --inject` when escalating to a human.
- Does not enforce anything by itself — like `loop-worktree`'s locks, this is advisory: a control script that skips calling `loop-gate` is not physically blocked. The mechanism is only as good as the scripts that call it.

See [docs/safety.md](../../docs/safety.md) for the policy this codifies, and [docs/primitives.md](../../docs/primitives.md) for where safety gates fit in the Five Building Blocks + Memory model.
