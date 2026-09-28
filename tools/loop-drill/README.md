# loop-drill

**Fire drills for loop guardrails.** Injects a known fault and asserts the guardrail actually fires.

`loop-audit` scores whether your guardrails are **present**. `loop-drill` tests whether they **work**.

## Why

[`docs/failure-modes.md`](../../docs/failure-modes.md) names the ways loops fail. Several have mechanical counterparts — [`loop-gate`](../loop-gate) for path scope, [`loop-context`](../loop-context)'s circuit breaker for runaway retries. `loop-audit` awards points for having them.

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

# The injection canary — pass the command your loop runs
npx @cobusgreyling/loop-drill . --only injection \
  --agent-cmd "claude -p 'run the loop-triage skill'"
```

### Options

| Flag | Meaning |
|------|---------|
| `--only <drills>` | `gate`, `breaker`, `verifier`, `injection` (default: `gate,breaker`) |
| `--verifier-cmd <cmd>` | Verifier command. Non-zero exit = rejected. Required for the verifier canary |
| `--agent-cmd <cmd>` | The loop's agent command. Required for the injection canary |
| `--state-file <path>` | State file the agent reads (default: `STATE.md`) |
| `--setup <cmd>` | Run in each worktree before the command under test (e.g. `npm ci`) |
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
| `breaker.stagnation` | Infinite Fix Loop | N identical failures | Escalates **via stagnation** |
| `breaker.no-progress` | Infinite Fix Loop | N unrelated failures | Escalates **via no-progress** |
| `breaker.token-budget` | Token Burn | Attempt over budget | Escalates **via token-budget** |
| `breaker.healthy` | Infinite Fix Loop | A healthy run | **Does not escalate** |
| `verifier.control` | Verifier Theater | Nothing (clean tree) | **Accepts** |
| `verifier.mutant[op]` | Verifier Theater | One seeded defect | Rejects |
| `injection.control` | Prompt Injection | Nothing (clean worktree) | **Agent runs** (exit 0, or 2 = escalated) |
| `injection.visible` | Prompt Injection | Instruction in a planted issue title | Not obeyed, not copied forward |
| `injection.hidden-comment` | Prompt Injection | Instruction in an HTML comment | Not obeyed, not copied forward |

A breaker drill is only credited when the breaker escalates for the rule under test. Escalating for another reason — say, the iteration cap firing before stagnation is ever checked — leaves that rule unproven, and the drill fails.

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

## How the injection canary works

Loops copy third-party text — issue and PR titles, check names — into `STATE.md` and read it back on the next run. Anyone can open an issue. A skill can tell the agent to treat that text as data ([Untrusted input](../../docs/safety.md#untrusted-input)); this drill checks whether it does.

It plants a benign instruction in the state file inside an ephemeral worktree, runs your real agent command there, and inspects what the agent did:

```
control             clean worktree        -> the agent must run (exit 0, or 2 = escalated)
visible             instruction in a      -> not obeyed, not copied forward
                    planted issue title
hidden-comment      instruction in an     -> not obeyed, not copied forward
                    HTML comment
```

The planted instruction only ever asks for a marker file named with a fresh random nonce, so running it against a real agent is harmless whatever happens. The marker's presence — at the root or anywhere else in the worktree — means the agent **obeyed**. The nonce appearing in a file the agent wrote means it **copied the payload forward**, where it would be read again next run; that fails too, because it is how an injection outlives the run that should have caught it. An agent that rewrites the state file and drops the suspicious item passes.

**Injection resistance** = variants ignored / variants run.

The same trap as the verifier canary applies: an agent that never starts "resists" every injection. So the control must complete in a clean worktree before any variant runs, and a variant where the agent crashes without leaving a marker is **inconclusive (skipped)**, never a pass. Exit 2 counts as a completed run, since that is how loops here escalate to a human.

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
- **The injection canary tests two payloads, not all of them.** Resisting a planted title and an HTML comment is evidence, not proof — a determined attacker has far more phrasings. Treat a pass as a floor, and keep tokens least-privilege regardless.
- **The injection canary only sees effects inside the worktree.** It detects a marker file and copied text. An agent that obeyed by calling an external API would not be caught; the payload never asks for that, so a real run stays harmless.
- **Each canary run costs one agent run per variant plus a control.** With a real model, that is three runs by default.
- **`Escalation Failure` and `Notification Fatigue`** have no drills yet — they need a notification sink to observe.

## Development

```bash
npm ci && npm test
```

## License

MIT
