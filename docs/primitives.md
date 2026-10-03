# The Five Primitives + Memory

This document expands on the core building blocks of loop engineering.

## 1. Automations / Scheduling

The heartbeat. Without scheduling, you just have a one-off agent run.

**Common realizations**:
- `/loop` (Grok)
- Scheduled tasks / cron in Claude Code
- GitHub Actions + repository dispatch
- `/goal` (run until a verifiable condition is true)
- Custom harness schedulers

Key properties: interval, fire-immediately, recurring vs one-shot, durable (survives restarts).

## 2. Worktrees

Parallelism without chaos.

When two agents edit the same files at the same time you get merge hell. Git worktrees (or equivalent isolated checkouts) give each agent its own working directory that shares history but not the working tree.

In Grok: pass `isolation: "worktree"` when spawning subagents, or use `--worktree` / dedicated sessions.

Cleanup is important — loops should delete the worktree when the task is done or handed off. The [loop-worktree](../tools/loop-worktree/) CLI makes this mechanical: one worktree per attempt, tracked in a manifest, swept on reject or escalation.

## 3. Skills

The persistent memory of *intent*.

A skill (usually a `SKILL.md` + optional scripts/references) encodes:
- Project conventions
- "We don't do it this way because of X incident"
- Build/test/lint commands
- Review standards
- Domain knowledge

Without skills the loop re-derives everything from scratch on every run (intent debt).

Skills are also the unit of reuse. Package them as plugins to share across repos or teams.

## 4. Plugins & Connectors (MCP)

A loop that can only read the filesystem is limited.

Connectors let the loop:
- Read and update Linear / Jira tickets
- Post to Slack / Discord
- Query databases or internal APIs
- Create branches and PRs on GitHub
- Trigger deploys or runbooks

MCP (Model Context Protocol) has become the common substrate, so connectors written for one tool often work in another.

## 5. Sub-agents (Maker / Checker Split)

The single most important structural pattern for reliable loops.

The agent that wrote the code is a terrible judge of its own work. A second agent (sometimes on a stronger model, always with different instructions) performs verification.

Common splits:
- Explorer → Implementer → Verifier
- Implementer → Security reviewer
- Implementer → Test writer + runner

In unattended loops, the verifier is what lets you (the human) walk away with some confidence.

`/goal` in several tools uses a fresh model to decide whether the stopping condition has been met — another application of the maker/checker idea.

## + Memory / State

The model has no long-term memory across separate turns or sessions.

The loop must read from and write to something durable:
- A `STATE.md` or `LOOP-STATE.json` in the repo
- A dedicated section of a Linear board or GitHub Project
- A small database row

Good state answers:
- What are we currently working on?
- What did we try last time and what was the outcome?
- What is waiting for a human?

The state file is often the single most important artifact the loop produces.

## How the Pieces Fit Together

A minimal viable loop usually starts with:
Scheduling + one skill (triage) + state file.

You then add:
- Worktree isolation when you start making changes
- Sub-agent verification when the loop is acting autonomously
- Connectors when you want it to drive tickets and PRs instead of just suggesting

The best loops are the ones where each new primitive is added only when the previous version has proven its value (and its failure modes).

## + System One decisions (Jev)

Mechanical gates (`loop-gate`) and circuit breakers (`loop-context`) cannot see jailbreaks in an issue body or tell a typo from a multi-file refactor. [Jev](./jev.md) is TypeSafe’s System One model: typed Choice / Score / Noul questions, calibrated probabilities, no prose. `loop-jev` uses it for model routing, semantic retrieval, LLM guardrails, and trace classification — cheap enough to run every turn.

See [architecture-diagrams.md](architecture-diagrams.md) for how these primitives map onto the actual `tools/` packages, plus the run-lifecycle and sequence diagrams.
