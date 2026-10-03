# Jev — System One decisions for loops

[Jev](https://docs.typesafe.ai/) is TypeSafe’s System One model. It does not write prose. You send **state** plus a map of typed questions; it returns calibrated probabilities your **code** turns into a route, a keep/drop, a block, or an escalation.

Loop Engineering already has mechanical safety ([`loop-gate`](../tools/loop-gate)) and run-history circuit breaking ([`loop-context`](../tools/loop-context)). Jev is the missing *semantic* layer: it is fast enough (~sub-second) and cheap enough (~$0.042 / million input tokens, output free) to sit on **every turn** without becoming a second LLM.

Companion library (same queries, standalone): [`cobusgreyling/Jev`](https://github.com/cobusgreyling/Jev).

## Where it sits

```text
goal / issue / PR body
        │
        ▼
 loop-jev guard (input)     ← jailbreak, injection, secret-ask, denylist pressure
        │
        ▼
 loop-jev route             ← nano | fast | balanced | frontier | reasoning
        │
        ▼
 loop-jev retrieve          ← which STATE / skill / log passages to inject
        │
        ▼
   coding agent (chosen model + pruned context)
        │
        ▼
 loop-jev guard (output)    ← secret leak, drift, hallucinated results
        │
        ▼
 loop-gate + loop-context   ← path denylist, auto-merge, stagnation
        │
        ▼
 loop-jev classify          ← failure mode on the trace, whether to escalate
```

`loop-jev turn` packs **input guard + route** into one TypeSafe request (speculative fan-out). That is the shape TypeSafe is trained for: many atomic questions, one ingest of state.

## Four queries

### 1. Model routing

`loop-jev route --goal "…" --pattern ci-sweeper --level L2`

A `Choice` over five tiers, plus `Score` difficulty and `Noul`s for tools / long context / maker-checker. Code maps the tier onto a model id. If Jev’s **confidence** on the choice is below `0.55`, the router does not blindly spend on `frontier` — it uses `balanced` and marks `uncertain`.

L1 daily triage should usually land on `fast`. A verifier or L3 security pass should land on `reasoning`.

### 2. Semantic context retrieval

`loop-jev retrieve --query "path denylist" --passages passages.json`

A `Choice` over passage ids (the probability vector *is* the ranking) plus a `Noul` “does any passage actually answer this?” plus a `Score` per passage. Keep the ones above threshold; drop the rest before they rot the context window.

This is the TypeSafe [re-rank / semantic-find](https://docs.typesafe.ai/cookbooks/semantic_find) pattern applied to `STATE.md`, skills, and run logs.

### 3. LLM error detection and guardrails

`loop-jev guard --side input --text "…"`
`loop-jev guard --side output --text "…"`

A battery of `Noul` hazards (jailbreak, prompt injection, secret exfil, denylist pressure, hallucination, instruction drift, secret leak) and a `Score` for harm. Thresholds live in code (`strict` / `permissive`). Jev assesses; the loop decides `pass` / `review` / `block` / `support`.

Exit `2` means escalate — same convention as `loop-gate check` and `loop-context --check`, so control scripts chain all three.

### 4. Reasoning-trace classification

`loop-jev classify --trace trace.jsonl`

Accepts Foundry-style JSONL, a JSON event array, or a `loop-context` ledger. Returns a `failure_mode` (`healthy`, `tool_loop`, `budget_burn`, `instruction_drift`, `verifier_fail`, `stagnation`, `hallucination`, `policy_denied`, `worktree_collision`, `other`) plus whether to escalate and whether maker/checker would help.

Use it at session end (or on `budget.exceeded`) instead of sending the whole trace to an LLM judge.

## Auth (do not leak the key)

```bash
export TYPESAFE_API_KEY=…                    # local / CI secret
# or
chmod 600 ~/.config/typesafe/api_key         # contents never committed
```

The client **redacts** `apikey_…`, `sk-…`, `ghp_…`, `Bearer …`, and `*_API_KEY=` values from `state` before the HTTP call. `loop-jev doctor` reports whether a key is configured and **never prints it**.

Without a key, a deterministic heuristic fallback runs so `npm test` and first-run `doctor` work offline. `--no-fallback` requires a live call.

## What this is not

- Not a replacement for `loop-gate`. Globs are still the denylist.
- Not a replacement for `loop-context`. Iteration caps still trip on ledgers.
- Not a writer. If you need a paragraph, that is still the coding agent.

## See also

- [`tools/loop-jev`](../tools/loop-jev) — CLI + library
- [TypeSafe primitives](https://docs.typesafe.ai/primitives) — Choice, Score, Noul
- [Confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing)
- [Guardrails cookbook](https://docs.typesafe.ai/cookbooks/llm_guardrails)
