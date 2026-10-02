# loop-drill

**Fire drills for loop guardrails.** Injects a known fault and asserts the guardrail actually fires.

`loop-audit` scores whether your guardrails are **present**. `loop-drill` tests whether they **work**.

## Why

[`docs/failure-modes.md`](../../docs/failure-modes.md) names ten ways loops fail. Several have mechanical counterparts — [`loop-gate`](../loop-gate) for path scope, [`loop-context`](../loop-context)'s circuit breaker for runaway retries. `loop-audit` awards points for having them.

Nothing checked whether they fire.

The sharpest case is the verifier. `loop-audit` gives its joint-largest signal (14 points) for a verifier and gates L3 on it, by checking whether a file whose *name* contains `verifier` exists:

```ts
if (base.includes('verifier') || base === 'loop-verifier')   // auditor.ts:181
```

An empty file passes. On a scratch repo, `touch .claude/agents/verifier.md` moves the score from **34 (L0)** to **55 (L1)**. `docs/failure-modes.md` calls the resulting failure **Verifier Theater** and rates it S2; `docs/primitives.md` calls maker/checker *"the single most important structural pattern for reliable loops"*.

loop-drill closes that gap by running the real verifier against real seeded defects.

## Usage

```bash
# Offline drills — no agent, no tokens, no network
npx @cobusgreyling/loop-drill .

# The verifier canary
npx @cobusgreyling/loop-drill . --only verifier \
  --verifier-cmd "npm test" --setup "npm ci"
```

### Options

| Flag | Meaning |
|------|---------|
| `--only <drills>` | `gate`, `breaker`, `verifier` (default: `gate,breaker`) |
| `--verifier-cmd <cmd>` | Verifier command. Non-zero exit = rejected. Required for the canary |
| `--setup <cmd>` | Run in each worktree before verifying (e.g. `npm ci`) |
| `--mutants <n>` | Seeded defects (default: 3) |
| `--scope <path>` | Restrict mutation to a repo-relative path |
| `--timeout <ms>` | Per-run timeout (default: 120000) |
| `--gate-file <path>` | Policy file (default: `gate.yaml`) |
| `--benign-path <path>` | Path the specificity drill treats as ordinary |
| `--token-budget <n>` | Token budget for the breaker drill |
| `--json` | Machine-readable output |

Exit codes match `loop-gate` and `loop-context` so control scripts chain all three: **0** all passed, **1** some skipped, **2** a guardrail failed to fire.

## The drills

Each drill is tagged with the `docs/failure-modes.md` entry it exercises, so the report reads as coverage of that document.

| Drill | Failure mode | Injected fault | Passes if |
|-------|--------------|----------------|-----------|
| `gate.denylist[glob]` | Over-Reach | A path matching each denylist entry | Blocked by the denylist |
| `gate.file-count` | Over-Reach | `maxFiles + 1` benign paths | Blocked by file-count |
| `gate.auto-merge` | Over-Reach | Non-allowlisted path, `--action auto-merge` | Blocked |
| `gate.benign` | Over-Reach | An ordinary doc change | **Allowed** |
| `breaker.stagnation` | Infinite Fix Loop | N identical failures | Escalates |
| `breaker.no-progress` | Infinite Fix Loop | N consecutive failures | Escalates |
| `breaker.token-budget` | Token Burn | Attempt over budget | Escalates |
| `breaker.healthy` | Infinite Fix Loop | A healthy run | **Does not escalate** |
| `breaker.config` | Infinite Fix Loop | Only reported when `loop-context` rejects the config (e.g. `similarityThreshold: 95`) | Never passes; the other breaker drills can't run |
| `verifier.control` | Verifier Theater | Nothing (clean tree) | **Accepts** |
| `verifier.mutant[op]` | Verifier Theater | One seeded defect | Rejects |

### Both directions, always

Every guardrail is drilled twice, because only one direction is easy:

- **sensitivity** — the fault is caught. A guardrail that never fires is theater.
- **specificity** — benign input is *not* caught. A guardrail that blocks everything passes every sensitivity drill while being useless.

A `denylist: ["**"]` catches every seeded fault and still fails, because it blocks an ordinary docs change too.

## How the verifier canary works

Borrowed from mutation testing. Rather than asking a model to invent a defect — non-deterministic and token-hungry — it applies a small mechanical edit to real source and checks whether the verifier notices:

```
control (repo)      no defect     -> must ACCEPT (exit 0)
control (worktree)  no defect     -> must ACCEPT (exit 0)
mutant × N          one defect    -> must REJECT (non-zero)
```

**Mutation score** = mutants rejected / mutants run.

Three properties make the result trustworthy:

1. **Isolation.** Each run happens in an ephemeral `git worktree`, removed even on throw, so a verifier that writes or builds cannot touch your checkout.
2. **The worktree control.** A fresh worktree has no `node_modules`. Without this second control, `npm test` would fail there for reasons unrelated to code quality and *every mutant would score as caught* — a broken setup reporting a perfect score. When it fails, mutants are **skipped, not scored**, and you're pointed at `--setup`.
3. **Bail on a failed control.** A verifier that rejects a clean tree catches every mutant while being worthless. The mutants never run, so it can't report 100%.

Operators are restricted to edits that change behaviour in any C-family language and that a reviewer would call a bug: `===`↔`!==`, `<=`→`<`, `>=`→`>`, `&&`→`||`, `return true`↔`return false`. Ambiguous edits are deliberately excluded — `<`→`>` breaks TS generics and JSX, `+`→`-` mangles string concatenation, and either would make a *correct* verifier look broken. Matches inside comments are skipped, and test files, `dist/`, and `node_modules/` are never mutated.

## Example

A rubber-stamp verifier, caught:

```
Verifier Theater — ❌ NOT PROVEN
  ✅ verifier accepts an unmodified tree
  ✅ verifier accepts a clean worktree
  ❌ verifier rejects strict-equality-flip in src/gate.ts:34
      expected: non-zero exit (rejected)
      actual:   exit 0 (approved a seeded defect)
      flip === to !== (typeof v === 'string' -> typeof v !== 'string')

Mutation score: 0% of seeded defects rejected
```

## Limitations

- **Mutation is regex-based, not AST-based.** It cannot construct a semantically interesting bug, only a mechanically detectable one. A verifier that catches every mutant is not proven to catch subtle logic errors — this establishes a floor, not a ceiling.
- **The canary costs whatever your verifier costs**, once per mutant plus two controls. Start with `--mutants 1` and `--scope`.
- **`Escalation Failure` and `Notification Fatigue`** have no drills yet — they need a notification sink to observe.

## Development

```bash
npm ci && npm test
```

## License

MIT
