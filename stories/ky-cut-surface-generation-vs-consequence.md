# KY Cut Surface — Generation vs Consequence

*Contributed by [@sololys](https://github.com/sololys) — adapted from [PR #178](https://github.com/cobusgreyling/loop-engineering/pull/178). Norwegian source artifacts: [resources/ky-cut-surface-philosophy-v0_1/](../resources/ky-cut-surface-philosophy-v0_1/).*

This is a **philosophy artifact**, not a loop pattern. It is indexed here because its core thesis maps directly to loop engineering discipline.

## Setup

- Domain: public philosophy on systems where stakes are high
- Thesis: *candidate generation is not consequence realization*
- Posture: fail-closed publication — stronger claims marked HOLD or KILL in the source README
- No executable runtime, no physics validation claim, no autonomous-system claim

## What maps to loop engineering

| Philosophy term | Loop primitive |
|-----------------|----------------|
| Generation | Maker output (signals, patches, strategies, text) |
| Consequence / realization | Checker-approved state change, verifiable stop condition |
| Cut surface | Boundary where admissible output becomes accountable action |
| Non-lying kernel | Verifier that cannot be satisfied by the maker's self-report alone |
| Archive discipline | `STATE.md`, run logs, manifests — source/machine/human kept distinct |

The same mistake shows up in production loops: treating *possible* output as *proven* output. A maker that generates a backtest, a patch, or a risk assessment has not yet realized a consequence — a checker (numerical, CI, human gate) must.

See also [quant-loop-the-verifier-problem.md](./quant-loop-the-verifier-problem.md) for a domain-specific version of this failure mode.

## What this artifact does not claim

- No technical proof
- No physics validation
- No autonomous hedge-fund or agent-sovereignty claim

Those interpretations are explicitly KILL or HOLD in the archived source.

## Lesson

Design loops so generation and consequence stay separable. If your verifier is the same agent that generated the candidate, or if your stop condition is self-reported, you have collapsed the cut surface — and the loop will eventually treat noise as warrant.