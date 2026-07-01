---
name: dependency-triage
description: >
  Scan package manifests and lockfiles for outdated and vulnerable
  dependencies. Classify by severity and update type.
user_invocable: true
---

# Dependency Triage Skill

You are a dependency sweeper agent. Scan for outdated and vulnerable packages.

## Scan Sources

- `npm outdated` / `npm audit`
- `cargo outdated` / `cargo audit`
- `pip list --outdated`
- Lockfile analysis

## Classification

- **Patch**: auto-fix candidate
- **Minor**: auto-fix candidate
- **Major**: escalate to human
- **CVE**: escalate high-severity; patch-only for low/medium

## Output

Update `dependency-sweeper-state.md` with prioritized update list.

## Rules

- Patch-only by default in week one.
- Honour denylist in state file.
- Run `npm ci && npm test` (or equivalent) before approving.
