# Sources & Attribution

This repository exists because of public discussion and practice by experienced practitioners. Primary sources:

## Core Definition & Framework

- **Cobus Greyling** — [Loop Engineering](https://cobusgreyling.substack.com/p/loop-engineering) (June 2026)
  Companion essay for this repository: context engineering vs harness engineering vs loop engineering, the five primitives + memory, Grok mapping, and production realities.

- **Addy Osmani** — [Loop Engineering](https://addyosmani.com/blog/loop-engineering/) (June 2026)
  The most complete written synthesis of the concept, including the five primitives + memory table and the concrete daily loop example.

- The originating X thread: https://x.com/addyosmani/status/2064127981161959567

## Anthropic / Claude Code Perspective

- **Boris Cherny** (Head of Claude Code at Anthropic)
  - Public statements: “I don’t prompt Claude anymore. I have loops running that prompt Claude and figuring out what to do. My job is to write loops.”
  - Practical usage shared in the community: `/loop 5m /babysit`, `/loop 30m /slack-feedback`, `/loop /post-merge-sweeper`, `/pr-pruner`, etc.
  - Emphasis on turning workflows into skills + loops.
  - `/loop`, `/goal`, and `/schedule` as first-class primitives in Claude Code.

- Related commentary from the Claude Code team (including @_catwu) highlighting loops as one of the highest-leverage features for long-term agentic work.

## Related Concepts (Osmani)

- Agent Harness Engineering
- The Factory Model
- Intent Debt
- Comprehension Debt
- Cognitive Surrender
- Orchestration Tax
- Code Agent Orchestra / Adversarial Code Review

These provide important context and guardrails for loop design.

## Other Early Signals

- Peter Steinberger: emphasis on designing loops rather than prompting agents directly.
- Various practitioners experimenting with closed-loop systems, feedback loop engineering, and "routines that prompt the model."

## Community Philosophy Artifacts

- **Marius ([@sololys](https://github.com/sololys))** — [KY Cut Surface Philosophy v0.1](./ky-cut-surface-philosophy-v0_1/) (July 2026)
  Archived public philosophy on the distinction between generation and consequence. Not a pattern or runtime — indexed via [stories/ky-cut-surface-generation-vs-consequence.md](../stories/ky-cut-surface-generation-vs-consequence.md).

- **Open-Spek** — [open-spek/loop](https://github.com/open-spek/loop), [open-spek.github.io](https://open-spek.github.io) (July 2026)
  An independently-developed, differently-scoped use of the term "loop engineering": a test-gated, fresh-context loop that turns a frozen Spek — the complete knowledge required to recreate a piece of software — into a verified implementation, one milestone at a time, rather than a scheduled maintenance cadence. First proof: [open-spek/jsonq](https://github.com/open-spek/jsonq) (21 iterations, 252 tests, 100 percent coverage, 0 human-edited lines). Not a pattern for this repo's registry — cross-linked here because the term collides across both projects and readers of either may otherwise conflate them.

## How This Repo Relates

We treat the above sources as the current best articulation of the idea and aim to turn the abstract framework into practical, copyable patterns, templates, and tool-specific guidance (with special attention to the Grok Build TUI, which has strong native support for the primitives).

If you have additional primary sources, real production loop stories, or corrections, please open an issue or PR.
