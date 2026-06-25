# Safety & Guardrails

Loops amplify judgment — good and bad. These guardrails are minimum bar for production loops that touch code or external systems.

## Path Denylist

The loop must **never** auto-edit these without human approval:

```
.env
.env.*
**/secrets/**
**/credentials/**
**/*_key*
**/*_secret*
.terraform/**
k8s/production/**
**/migrations/**          # unless explicit migration loop
auth/**
payments/**
billing/**
```

Encode in `minimal-fix` and implementer skills:

> Do not modify files matching the denylist. Escalate to human with context.

## Auto-Merge Policy

**Default: no auto-merge.**

If you allow auto-merge for trivial loops:

| Allowed | Not allowed |
|---------|-------------|
| Typo in comment/docs | Behavior changes |
| Lint auto-fix in test files only | Dependency version bumps |
| Import ordering | Lockfile changes |
| Config in allowlisted `docs/` paths | Any denylist path |

Document allowlist in `AGENTS.md` or a dedicated `loop-auto-merge-allowlist.md`.

## MCP Connector Least Privilege

| Connector | Read | Write |
|-----------|------|-------|
| GitHub | issues, PRs, checks | comment, label (not merge by default) |
| Linear | team issues | comment, status (not delete) |
| Slack | channel history | post to `#loop-escalations` only |
| Database | — | no production write from loops |

Use separate bot accounts / tokens with minimal scopes.

## Human Gates (Required)

Always require human for:

- Security, authentication, authorization
- Payments, billing, PII handling
- Infrastructure / Terraform / K8s prod
- Dependency upgrades (supply chain risk)
- Changes touching >N files (suggest N=10)
- Third attempt failed on same item

## Secrets in Prompts & Logs

- Never paste API keys into scheduler prompts
- CI logs may contain secrets — triage skill should redact before state write
- State files are often committed — no credentials in `STATE.md`

## Flake & Test Safety

- Do not disable tests to make CI green
- Do not increase timeouts blindly without root-cause note
- Quarantine flakes via explicit ticket + human approval
## Incident Response

If a loop merges bad code:

1. Pause all loops immediately (`scheduler_list` → delete)
2. Revert merge
3. Record in state + `stories/`
4. Tighten verifier or shrink scope before restart

## Pre-Flight Safety Check

Before L3 (unattended):

- [ ] Denylist in skills
- [ ] Auto-merge off or strict allowlist
- [ ] Connector scopes reviewed
- [ ] Human gates documented in pattern
- [ ] Kill switch documented ([operating-loops.md](./operating-loops.md))

See also [loop-design-checklist.md](./loop-design-checklist.md).

## Machine-Readable Constraints

For runtime enforcement, define constraints in `loop-constraints.md` at the project root.
The `loop-constraints` skill reads this file at the start of every loop run and enforces
every rule. Template: [templates/loop-constraints.md](../templates/loop-constraints.md).

Tool examples: [Grok](../examples/grok/constraints.md) · [Claude Code](../examples/claude-code/constraints.md) · [Codex](../examples/codex/constraints.md)