---
name: pr-review-triage
description: >
  Triage open pull requests for CI status, review comments, and merge readiness.
  Use in PR babysitter loops. Respects project review norms and required checks.
user_invocable: true
---

# PR Review Triage Skill

For each watched PR, report:

## Per-PR Output

```markdown
### PR #N — title
- Checks: passing | failing | pending | absent/unknown — list names and conclusions
- Required-check policy: known and satisfied | known and unsatisfied | unknown
- Reviews: approved N | changes requested | review required | absent/unknown
- Mergeability: clean | conflicts | unknown
- Blocking comments: (list actionable ones)
- Ready to merge: yes | no — reason
- Suggested loop action: none | minimal-fix | rebase | escalate-human
```

## Rules

- Zero checks, or no check runs/status contexts returned, means `absent/unknown`,
  not `passing`, unless the repository policy explicitly requires no checks.
- Separate functional CI from administrative statuses such as a CLA or labeler;
  list both, but do not use administrative success as evidence that tests passed.
- `mergeable` or a clean merge state only means Git found no conflict. It does
  not mean the PR is ready, reviewed, or verified.
- "Ready to merge" requires a known project policy, every required check
  satisfied, required approvals present, no changes requested, no blocking
  comments, and no merge conflict.
- If the required-check or review policy cannot be established, report
  `Ready to merge: no` and escalate to a human.
- Non-actionable nits → note but do not spawn fix.
- If PR idle >4 days → suggest human handoff.
- High-risk labels (security, breaking) → escalate-human always.
