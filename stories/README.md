# Production Stories

Real-world loop engineering — including failures. Contribute yours via [CONTRIBUTING.md](../CONTRIBUTING.md).

| Story | Pattern | Takeaway |
|-------|---------|----------|
| [pr-babysitter-week-one.md](./pr-babysitter-week-one.md) | PR Babysitter | State + attempt limits + verifier |
| [daily-triage-report-only.md](./daily-triage-report-only.md) | Daily Triage | L1 before L2 |
| [why-we-killed-ci-sweeper.md](./why-we-killed-ci-sweeper.md) | CI Sweeper | Budget, branch allowlist, kill switch |
| [dependency-sweeper-week-one.md](./dependency-sweeper-week-one.md) | Dependency Sweeper | Verifier must match CI install path |
| [multi-loop-collision.md](./multi-loop-collision.md) | Multi-loop | Branch lock + collision detection |
| [l1-to-l2-graduation.md](./l1-to-l2-graduation.md) | Daily Triage | Calibration before auto-fix |
| [changelog-drafter-week-one.md](./changelog-drafter-week-one.md) | Changelog Drafter | Low-risk, high-ROI L1 win |
| [post-merge-cleanup-honest-win.md](./post-merge-cleanup-honest-win.md) | Post-Merge Cleanup | Off-peak cadence; verifier caught doc/API drift; bot-merge noise |
| [contributing-opencode-reference.md](./contributing-opencode-reference.md) | Contributing | CI gates caught 3 issues; schema should be registry-driven; fork PR cosmetic 403 |

**Template for new stories:**

```markdown
# Title — Context
## Setup
## What Worked
## What Broke
## Metrics (if any)
## Lesson
```