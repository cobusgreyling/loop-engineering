# Decisions and current work

<!-- Written by `knos export`. Commit this file. -->

<!--
Reading this file needs nothing installed: it is plain markdown, and a fresh
clone picks it up as-is. The live claim/withhold server is a separate, optional
step - `pip install knos` (Python 3.10+), which the MCP entry launches as
`python -m knos.mcp`. Without it, everything below still reads normally.
-->


A second clone reads this on its first question — it is one of the decision
records knos looks for. Nothing here is private: secrets and private paths
never reach it.


## Decisions

- **shared state without schema** — Three loops appending to one unstructured STATE.md causes state rot, conflicting actions and ghost items. One state file per pattern, or clearly separated sections with prune rules.  _(docs/anti-patterns.md)_
- **attempt cap** — No loop runs "keep trying until CI is green". Hard cap at three attempts, then escalate with full context in the state file.  _(docs/anti-patterns.md)_
- **separate verifier** — The agent that implements does not verify its own work. A separate verifier sub-agent or model checks it, and the verifier's default stance is REJECT.  _(docs/anti-patterns.md)_
- **L1 before L3** — Report-only for the first week. Measure triage accuracy before enabling anything that writes.  _(docs/anti-patterns.md)_
- **propose, never merge** — Any loop that changes external state opens a draft PR or a comment for a human gate. It never merges.  _(examples/mcp/safe-write-pattern.md)_
- **minimum privilege** — Loops get the least privilege that works. Prefer read + comment over write; use human gates and worktrees for anything that mutates state.  _(examples/mcp/README.md)_

## Being worked on right now

_Nothing claimed._

---
<sub>knos export. Claims lapse after 30 minutes.</sub>
