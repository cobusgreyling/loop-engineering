# Primitives Matrix — Grok, Claude Code, Codex, OpenClaw, Opencode, Cursor, Windsurf, Hermes

Tool-agnostic loop design: the **capability** is what matters, not the product name. This matrix maps each primitive to how it appears in eight major agent environments.

| Primitive | Job in the Loop | Grok Build TUI | Claude Code | Codex | OpenClaw | Opencode | Cursor | Windsurf | Hermes |
|-----------|-----------------|----------------|-------------|-------|----------|----------|--------|----------|--------|
| **Automations / Scheduling** | Discovery + triage on a cadence | `/loop [interval] <prompt>`, `scheduler_create` / `scheduler_list` / `scheduler_delete` (`recurring`, `durable`, `fireImmediately`), `monitor` for streaming events | `/loop`, scheduled tasks, cron, hooks, GitHub Actions | [Automations tab](https://developers.openai.com/codex/app/automations): project, prompt, cadence, environment; Triage inbox | [`openclaw cron`](https://docs.openclaw.ai/automation/cron-jobs) (`--cron` / `--every` / `--at`, isolated or main session); webhooks (`POST /hooks/agent`, `/hooks/wake`); heartbeat | OS cron / systemd timer / GitHub Action invokes `opencode run "..."`; headless server via `opencode serve` | Cloud Agents + **Automations** (cron, webhooks, Linear/GitHub/Slack triggers); foreground Agent chat for ad-hoc `/loop`-style prompts | Cascade **Workflows** (`/workflow-name`, manual invoke); pair with GitHub Actions or external cron for true scheduling | [`hermes cron create "<cron>" --skill … --deliver local\|origin\|<channel>\|platform:chat_id:thread_id --workdir "$PWD"`](https://hermes-agent.nousresearch.com/docs); webhooks via `POST /hooks/agent`; per-job `context_from` chains upstream job stdout into downstream prompt |
| **Run-until-done** | Keep working until a verifiable condition holds | [`/goal`](https://github.com/cobusgreyling/goal-engineering) + `update_goal` — persistent objective across turns ([Goal Engineering](https://github.com/cobusgreyling/goal-engineering)) | `/goal` — separate model checks completion | `/goal` — pause/resume, verifiable stop condition | Recurring isolated cron with explicit stop condition in `--message`; delegate via `coding-agent` skill to external CLI; hand off bounded work to Goal Engineering | Bounded `opencode run "<goal + stop condition>"` sessions; follow with verifier agent via `--agent verifier` | Agent mode + **hooks** (`.cursor/hooks.json`) for grind-until-green loops | Workflow steps with explicit verification checkpoints; **Memories** for cross-session continuity | Chained cron jobs via `hermes cron edit --context-from <upstream-id>`; skill loops using `delegate_task` until a verifiable stop condition holds; `hermes cron edit --schedule` adjusts cadence live |
| **Worktrees** | Safe parallel execution | Subagents with `isolation: "worktree"`, background tasks | `git worktree`, `--worktree`, `isolation: worktree` on subagents | Built-in worktree per thread | `exec` + `git worktree` in agent workspace; `coding-agent` delegates to CLI backends; optional sandbox per agent | Explicit `git worktree` per implementer run; pass worktree path with `--dir` | Git worktree per Composer / Cloud Agent task | Workspace isolation; multiple simultaneous Cascade sessions | Standard `git worktree` inside the cron job; `--workdir` pins tool cwd + injects `AGENTS.md` per job so parallel jobs cannot collide |
| **Skills** | Persistent project knowledge | `SKILL.md` in `.grok/skills/` or `~/.grok/skills/`; invoked by name | `SKILL.md` in `.claude/skills/` or project skills | [Agent Skills](https://developers.openai.com/codex/skills) — `$name` or implicit match | `SKILL.md` in `<workspace>/skills/`, `.agents/skills`, or `~/.openclaw/skills`; [AgentSkills](https://agentskills.io) spec; [ClawHub](https://clawhub.ai) + `openclaw skills install` | `SKILL.md` in `skills/<name>/`; `AGENTS.md` for always-on repo rules | `.cursor/rules/*.mdc` (globs, `alwaysApply`), `AGENTS.md`, `.cursor/skills/` | `.devin/rules/` or `.windsurf/rules/` (persistent context); `.windsurf/workflows/` (reusable recipes) | `SKILL.md` under `~/.hermes/skills/<name>/` (user) or `.hermes/skills/<name>/` (project); `hermes skills install/list/inspect`; invoked via `--skill <name>` on cron jobs, or auto-loaded by description match |
| **Plugins & Connectors** | Reach into real tools | MCP servers via `CallMcpTool` | MCP servers + plugins | Connectors (MCP) + plugins for distribution | MCP + channel plugins (Slack, Telegram, WhatsApp, etc.); browser automation plugin | MCP servers in `opencode.json`; GitHub/Linear/Slack via CLI or MCP bridge | MCP in settings; Cloud Agent sandbox with full connector access | MCP via Cascade settings / `mcp_config.json` | MCP servers via `hermes mcp add`; built-in home channels (Feishu, Slack, Discord, Telegram, WhatsApp, SMS); `hermes send` delivers to any connected channel |
| **Sub-agents** | Maker / checker split | `Task` tool with `subagent_type`, worktree isolation | Task subagents in `.claude/agents/`, agent teams | Subagents as TOML in `.codex/agents/` | `agents.list` multi-agent routing; isolated cron subagent orchestration; separate verifier agent id | Named agents via `opencode agent`; invoke one role per run with `--agent verifier` or `--agent implementer` | Multi-agent mode, review mode, custom agents in `.cursor/agents/` | Multiple Cascades in parallel; workflow-orchestrated implementer → reviewer steps | `delegate_task(goal=..., role='leaf'\|'orchestrator', toolsets=[...])` — background execution, isolated context, result re-enters as a new message; up to N children in parallel per `delegation.max_concurrent_children` |
| **State / Memory** | Track what's done across runs | `STATE.md`, todos, durable scheduler state | `AGENTS.md`, progress files, Linear via MCP | Markdown or Linear via connector | `STATE.md`, `HEARTBEAT.md` in workspace; cron persisted in Gateway SQLite; Skill Workshop for skill proposals | `STATE.md`, `LOOP.md`, `AGENTS.md`, session export via `opencode export <sessionID>` | `STATE.md`, `LOOP.md`, Cloud Agent memories | `STATE.md`, Cascade **Memories**, workflow run notes | `STATE.md` in `--workdir`; `HEARTBEAT.md` for periodic polls; persistent facts via `hermes memory` (survive across sessions); cron jobs stored in gateway SQLite |

**Reference MCP server:** this repo ships [`tools/mcp-server/`](../tools/mcp-server/) — patterns, skills, state, budget, and safety docs as runtime-queryable MCP resources (reduces prompt stuffing). Config example: [`examples/mcp/loop-engineering.mcp.json`](../examples/mcp/loop-engineering.mcp.json).

## Scheduling Quick Reference

| Use case | Grok | Claude Code | Codex | OpenClaw | Opencode | Cursor | Windsurf | Hermes |
|----------|------|-------------|-------|----------|----------|--------|----------|--------|
| Every 5 minutes | `/loop 5m <prompt>` | `/loop 5m <prompt>` | Automation, 5m cadence | `openclaw cron create "*/5 * * * *" --session isolated --message "..."` | Cron/systemd calls `opencode run "..."` | Automation cron trigger | External cron + `/workflow` or Action | `hermes cron create "*/5 * * * *" --deliver local --skill loop-triage "..."` |
| Daily morning | `/loop 1d <prompt>` | Cron / `/loop 1d` | Automation, daily | `openclaw cron create "0 7 * * *" --tz ... --session isolated` + optional `--announce` | Cron/systemd calls `opencode run "Run loop-triage"` | Automation daily + `AGENTS.md` context | Daily workflow + Memories | `hermes cron create "0 7 * * *" --name "Daily triage" --deliver local --skill loop-triage --workdir "$PWD" "..."` |
| Until tests pass | [`/goal`](https://github.com/cobusgreyling/goal-engineering/blob/main/patterns/tests-green.md) + `goal-verifier` skill (or loop + verifier) | `/goal all tests pass` | `/goal` | Isolated cron + verifier in message, or `coding-agent` + external CLI | `opencode run "Goal: all tests pass. Stop when verifier approves."` | Hooks grind-until-green | Workflow with test/fix loop | Bounded skill loop using `delegate_task` for the maker + a second `delegate_task` as checker; or chained cron jobs with `context_from` |
| Survive restart | `scheduler_create` with `durable: true` | Hooks + persisted config | Automation (server-side) | Cron jobs persist in Gateway SQLite | systemd timer + committed `STATE.md` + exported sessions | Cloud Agent + repo-persisted state | Memories + committed `STATE.md` | Cron jobs persist in gateway SQLite; `--workdir` re-injects project context on every tick |
| Event-driven (CI fail) | `monitor` or GitHub Action | GitHub Action + webhook | Automation + webhook | `POST /hooks/agent` or mapped webhooks | GitHub Action / webhook bridge calls `opencode run` | Automation on PR/issue events | GitHub Action triggers + `/workflow` | `POST /hooks/agent` with `{"message":"…","name":"…","deliver":"local"}` |

## Skill Packaging

| Concept | Grok | Claude Code | Codex | OpenClaw | Opencode | Cursor | Windsurf | Hermes |
|---------|------|-------------|-------|----------|----------|--------|----------|--------|
| Authoring format | `SKILL.md` + optional scripts/references | Same | Same | Same ([AgentSkills](https://agentskills.io)) | Same (`SKILL.md` under `skills/<name>/`) | `SKILL.md` or `.mdc` rules with frontmatter | Markdown rules + workflow files | `SKILL.md` + optional `references/`, `templates/`, `scripts/`, `assets/` ([AgentSkills](https://agentskills.io) spec) |
| Distribution | Copy to `.grok/skills/` or user skills dir | Plugin / copy to project | Plugin bundle | `<workspace>/skills/`, ClawHub, `openclaw skills install` | Copy to `skills/`; keep project rules in `AGENTS.md` | `.cursor/skills/` or `.cursor/rules/` | `.windsurf/rules/` + `.windsurf/workflows/` in repo | `~/.hermes/skills/<name>/` (user) or `.hermes/skills/<name>/` (project); `hermes skills install <name>` from skills.sh, ClawHub, well-known endpoints, GitHub |
| Invocation | Skill name in prompt or auto-match on description | `$skill-name` or implicit | `$skill-name` | Slash command or auto-injected in system prompt | Name the skill in the `opencode run` message, or configure named agents in `opencode.json` | Rules auto-apply by glob; skills on demand | `/workflow-name` or Rules always-on in Cascade | `--skill <name>` on cron jobs; auto-loaded by description match mid-session; `--skills X,Y` on `hermes chat` for one-off preload |

## Sub-agent Patterns

| Split | When to use | Grok | Claude Code | Codex | OpenClaw | Opencode | Cursor | Windsurf | Hermes |
|-------|-------------|------|-------------|-------|----------|----------|--------|----------|--------|
| Implementer → Verifier | Any unattended code change | `Task` + different instructions/model | `.claude/agents/reviewer.md` | TOML agent with higher `reasoning_effort` | Separate `agents.list` id or verifier block in cron message | `opencode run "..." --agent implementer` in worktree, then `opencode run "Verify diff" --agent verifier --file diff.patch` | Review mode or second Cloud Agent pass | Second Cascade or workflow review step | Two sequential `delegate_task` calls (first `role='leaf'` with terminal+file; second `role='leaf'` with review-only toolsets); or two chained cron jobs via `context_from` |
| Explorer → Implementer | Large unfamiliar codebase | `explore` subagent_type | Explorer agent | Fast read-only subagent | `--light-context` cron + follow-up isolated job | First `opencode run "read-only exploration..."`, then follow-up implementer in a worktree | `@codebase` + plan mode first | Audit workflow (read-only) then implement | First `delegate_task(toolsets=['file'], goal='read-only exploration…')`, then follow-up `delegate_task(toolsets=['terminal','file'], goal='implement…')` in a worktree |
| Triage only | Report-first loops | `loop-triage` skill | `$loop-triage` | Automation calls skill | `loop-triage` + isolated cron; restrict `--tools` | `opencode run "Run loop-triage. Do not edit code."` | `AGENTS.md` + report-only rule | Triage workflow, no edit steps | `loop-triage` skill + `hermes cron` with `--deliver local`; restrict skill's tool list; no `delegate_task` in the prompt |

## State Conventions

Recommended filenames (pick one spine per project):

| File | Purpose |
|------|---------|
| `STATE.md` | General loop memory (daily triage) |
| `issue-triage-state.md` | Issue queue health (feeder for daily triage) |
| `pr-babysitter-state.md` | PR-specific watcher state |
| `ci-sweeper-state.md` | Active CI failures + attempt counts |
| `post-merge-state.md` | Cleanup backlog from recent merges |

Linear / GitHub Projects work equally well — the loop must **read and write** the same store every run.

## Choosing a Tool

You do not need to pick one forever. A well-designed loop transfers:

1. Write the **skill** (tool-agnostic `SKILL.md`)
2. Define the **state schema** (markdown or JSON)
3. Document the **verification split** (who checks whom)
4. Map scheduling to your current TUI, editor, or Action

For opencode, the transfer usually means `skills/`, `STATE.md`, `AGENTS.md`, and cron/systemd invoking `opencode run`. See [examples/](../examples/) for the same pattern implemented across tools.

## Copy-paste starters (Daily Triage, L1)

| Tool | Starter |
|------|---------|
| Grok | [starters/minimal-loop](../starters/minimal-loop/) |
| Claude Code | [starters/minimal-loop-claude](../starters/minimal-loop-claude/) |
| Codex | [starters/minimal-loop-codex](../starters/minimal-loop-codex/) |
| OpenClaw | [examples/openclaw/daily-triage.md](../examples/openclaw/daily-triage.md) — copy `skills/` + `STATE.md`; no `loop-init` yet |
| Opencode | [starters/minimal-loop-opencode](../starters/minimal-loop-opencode/) |
| Cursor / Windsurf | Copy `SKILL.md` + `STATE.md` from any starter; map scheduling to editor Automations or Workflows (see appendix) |
| Hermes | [examples/hermes/daily-triage.md](../examples/hermes/daily-triage.md) — copy `starters/minimal-loop/STATE.md.example` to project root; install `loop-triage` skill under `~/.hermes/skills/`; schedule with `hermes cron create`. No `loop-init --tool hermes` yet — this bridge is the current path. |

Audit after copying: `npx @cobusgreyling/loop-audit . --suggest`

Scaffold automatically: `npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok`

## Goals (run-until-done)

Loops discover ongoing work; **goals finish bounded tasks**. Canonical reference: **[Goal Engineering](https://github.com/cobusgreyling/goal-engineering)** (`/goal`, `update_goal`, `GOAL.md`, `goal-verifier`).

| Handoff | Command |
|---------|---------|
| Loop found a fixable item | `/goal Read STATE.md top item. Complete per goal-engineering pattern. goal-verifier before done.` |
| Audit goal readiness | `npx @cobusgreyling/goal-audit . --suggest` |
| Goal vs loop decision | [goal-vs-loop.md](https://github.com/cobusgreyling/goal-engineering/blob/main/docs/goal-vs-loop.md) |

## Appendix: Editor transfer recipes (Opencode, Cursor & Windsurf)

Transfer recipes map the same loop shape onto each host:

| Step | Opencode | Cursor | Windsurf |
|------|----------|--------|----------|
| 1. Skills | Copy `templates/SKILL.md.loop-triage` → `skills/loop-triage/SKILL.md`; add always-on rules in `AGENTS.md` | Copy `templates/SKILL.md.loop-triage` → `.cursor/skills/loop-triage/SKILL.md`; add always-on triage rules in `.cursor/rules/` | Copy skill content into `.windsurf/rules/loop-triage.md` |
| 2. State | `cp starters/minimal-loop-opencode/STATE.md.example STATE.md` | `cp starters/minimal-loop/STATE.md.example STATE.md` | Same — commit `STATE.md` at repo root |
| 3. Scheduling | Cron/systemd calls `opencode run "Run loop-triage"`; use `--session` / `--continue` for continuity | Cloud Automation (cron) or manual Agent prompt on cadence | Create `.windsurf/workflows/daily-triage.md`, invoke `/daily-triage` |
| 4. Verification | Create a verifier named agent with `opencode agent`; invoke via `opencode run "Verify diff" --agent verifier --file diff.patch` | `.cursor/agents/loop-verifier.md` from `templates/SKILL.md.verifier` | Add review step at end of workflow; human gate on denylist paths |
| 5. Connectors | Configure MCP or CLI bridges in `opencode.json` | Enable GitHub MCP read-only for issue/PR discovery | Configure GitHub MCP in Cascade settings |

## Appendix: Codeium (Windsurf)

Codeium rebranded its agentic surface to Windsurf; the agent itself is called
Cascade. There is no standalone Codeium CLI — "Codeium" as a brand today
mostly covers enterprise completion analytics, not agent loop primitives.
This appendix documents the **Windsurf IDE / Cascade agent**, the same
surface referenced in the Editor transfer recipes table above.

| Primitive | Windsurf (Cascade) mapping |
|-----------|----------------------------|
| Scheduling | No native cron-style scheduler. Use `.windsurf/workflows/<name>.md` invoked manually via `/workflow-name`, or pair with an external scheduler (cron, systemd, GitHub Actions) that reopens the workspace and triggers a workflow. |
| Skills / Rules path | Project rules: `.windsurfrules` (root) or `.windsurf/rules/` for multiple files. Global rules across all projects: `~/.codeium/windsurf/memories/global_rules.md`. |
| State | No native `STATE.md` convention. Commit `STATE.md` at the repo root manually, same as other editor-hosted tools; Cascade's built-in Memories system (per-workspace) can supplement but does not replace a committed state file. |
| Maker/checker split | No native subagent or reviewer role. Workaround: run the maker in one Cascade session, then open a second session (or manually review the diff view) as the checker before accepting changes. |
| Worktrees | Not native. Use standard git branches/worktrees and review through Cascade's diff view before merge, same as Aider. |
| Connectors | Configure MCP servers directly in Cascade/Windsurf settings for GitHub, issue/PR discovery, or other external context. |
| Honest gaps | No durable scheduler for headless/unattended runs, no built-in maker/checker separation, no first-class state-file convention — Windsurf's loop primitives are almost entirely manual and session-driven today. |

Minimal transfer recipe:

```bash
mkdir -p .windsurf/rules .windsurf/workflows
cp templates/SKILL.md.loop-triage .windsurf/rules/loop-triage.md
cp starters/minimal-loop/STATE.md.example STATE.md
```

Week-one Daily Triage workflow (`.windsurf/workflows/daily-triage.md`), report-only:

```text
Run loop-triage for this repository.

Read STATE.md first.
Update STATE.md with High Priority and Watch List only.
Do not edit source code in week one.
```

Invoke with `/daily-triage` in the Cascade panel.

Verifier pass for later L2 work — open a second Cascade session:

```text
Act as loop-verifier.

Review the current git diff against STATE.md goals.
Report PASS/FAIL and do not edit files.
```

After copying: map scheduling to manual `/workflow-name` invocation or an external
scheduler until Windsurf has a first-class cron-equivalent. Use `.windsurfrules`
or `.windsurf/rules/` for always-on repo guidance, and a second Cascade session
(or human diff review) for maker/checker separation.

## Appendix: Aider CLI

Aider is CLI-first rather than a loop host with native schedulers, so map the same primitives from [Choosing a Tool](#choosing-a-tool) onto shell scripts, cron, and git branches.

| Primitive | Aider mapping |
|-----------|---------------|
| Scheduling | Run one-shot scripted sessions from cron/systemd/GitHub Actions with `aider --message` or `aider --message-file`, or use `--watch-files` for comment-triggered work. |
| Skills | Load loop instructions as read-only context with `--read templates/SKILL.md.loop-triage` or a project-specific conventions file. |
| State | Keep `STATE.md` at the repo root and pass it as the editable file for triage loops; use pattern-specific state files such as `pr-babysitter-state.md` for specialized loops. |
| Maker/checker split | Run the implementer in one Aider session/branch, then run a second read-only reviewer session over `git diff` or `diff.patch` before any commit/PR. |
| Connectors | Prefer CLI tools or MCP sidecars called from scripts; keep credentials out of prompts and state files. |

Week-one Daily Triage command (report-only, state updates only):

```bash
aider STATE.md \
  --read templates/SKILL.md.loop-triage \
  --no-auto-commits \
  --no-dirty-commits \
  --message "Run loop-triage. Update STATE.md with High Priority and Watch List only. Do not edit source code in week one."
```

Verifier pass for later L2 work:

```bash
git diff > diff.patch
aider --read diff.patch --read STATE.md \
  --no-auto-commits \
  --no-dirty-commits \
  --message "Act as loop-verifier. Review the diff against STATE.md goals. Report PASS/FAIL and do not edit files."
```

Transfer recipe: copy the tool-agnostic `SKILL.md` + state schema from this repo; map scheduling to cron, systemd, or CI until Aider is wrapped by a richer loop scheduler.

## Appendix: Zed

Zed is editor-hosted rather than a standalone loop scheduler, so map the same primitives from [Choosing a Tool](#choosing-a-tool) onto [Agent Panel](https://zed.dev/docs/ai/agent-panel) threads, [Instructions](https://zed.dev/docs/ai/instructions), [Skills](https://zed.dev/docs/ai/skills), [Agent Profiles](https://zed.dev/docs/ai/agent-profiles), [Tool Permissions](https://zed.dev/docs/ai/tool-permissions), [MCP](https://zed.dev/docs/ai/mcp) servers, [Terminal Threads](https://zed.dev/docs/ai/terminal-threads), [Tasks](https://zed.dev/docs/tasks), and [Parallel Agents](https://zed.dev/docs/ai/parallel-agents) worktrees.

| Primitive | Zed mapping |
|-----------|-------------|
| Scheduling | Zed does not currently expose a first-class cron-style loop scheduler. Use Agent Panel threads or Terminal Threads for manual/ad-hoc runs, Zed Tasks for editor-side command hooks, and cron, systemd, GitHub Actions, or another external scheduler for cadence. |
| Project rules / skills path | Put always-on repo guidance in project instructions, preferably `AGENTS.md`; Zed also supports `.rules`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`. Put reusable workflows in project-local Skills under `.agents/skills/<name>/SKILL.md`. |
| State | Keep `STATE.md` at the repo root and make every loop prompt read and update the same file. Zed thread history helps local continuity, but committed markdown state is the portable memory spine across restarts, agents, and external schedulers. |
| Worktrees | Use Parallel Agents with git worktree isolation when multiple threads may edit the same files; review the diff and merge through normal git flow. |
| Maker/checker split | Run the maker in a Write profile thread, then run a second Ask/read-only or restricted custom profile thread over `git diff`, `STATE.md`, and the acceptance criteria. Use Tool Permissions to keep destructive tools denied or confirmation-gated for the checker. |
| Connectors | Configure MCP servers in Zed Agent Settings for GitHub, docs lookup, issue/PR discovery, or other external context. External Agents and Terminal Threads may use their own native config, so do not assume Zed controls every connector. Keep credentials out of prompts and state files. |

Minimal transfer recipe:

```bash
mkdir -p .agents/skills/loop-triage .agents/skills/loop-verifier
cp templates/SKILL.md.loop-triage .agents/skills/loop-triage/SKILL.md
cp templates/SKILL.md.verifier .agents/skills/loop-verifier/SKILL.md
cp starters/minimal-loop/STATE.md.example STATE.md
```

Week-one Daily Triage prompt (report-only, state updates only):

```text
Run loop-triage for this repository.

Read AGENTS.md and STATE.md first.
Update STATE.md with High Priority and Watch List only.
Do not edit source code in week one.
Use MCP tools only when needed for issue/PR discovery.
```

Verifier pass for later L2 work:

```text
Act as loop-verifier.

Review git diff against STATE.md goals and the issue acceptance criteria.
Use an Ask/read-only or confirmation-gated profile.
Report PASS/FAIL and do not edit files.
```

After copying: map scheduling to manual Agent Panel threads, Terminal Threads, Zed Tasks, or an external scheduler until Zed has a richer first-class loop scheduler. Use `AGENTS.md` for always-on repo rules, `.agents/skills/<name>/SKILL.md` for reusable workflows, Agent Profiles / Tool Permissions for maker-checker separation, and MCP for external tools.

## Appendix: Gemini CLI

Gemini CLI is a terminal-based agent tool. Map the same loop primitives onto the `gemini` command, external schedulers, context files, and separate verification sessions.

| Primitive | Gemini CLI mapping |
|-----------|--------------------|
| Scheduling | Use external schedulers such as cron, systemd timers, or GitHub Actions to invoke Gemini CLI workflows on a cadence. |
| Skills / Context Files | Use project context files such as `GEMINI.md` and repository documentation to provide instructions, conventions, and background information. |
| State | Keep persistent loop state in files such as `STATE.md.example`. Each run should read existing state, update only relevant sections, and preserve history. |
| Maker/checker split | Use separate Gemini CLI sessions: one session creates changes, another reviews output, validates requirements, and checks the diff. |
| Connectors | Use available MCP servers or external tools to provide additional context and capabilities. |

### Week-one Daily Triage Example

A Gemini CLI daily triage loop:

1. Start Gemini CLI from the repository root.
2. Read `STATE.md.example`.
3. Review pending triage items.
4. Update only triage sections.
5. Do not edit source files during the first week.
6. Save updated state for the next run.

### Official Documentation

https://github.com/google-gemini/gemini-cli
