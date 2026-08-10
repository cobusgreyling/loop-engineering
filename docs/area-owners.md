# Area owners

Optional community ownership for review routing. **Owner** still ships `main` and releases; area owners help triage and review scoped PRs faster.

| Area | Paths | Owner | Scope |
|------|-------|-------|--------|
| **Maintainer** | repo-wide | [@cobusgreyling](https://github.com/cobusgreyling) | Releases, tools, patterns, safety |
| **Docs / examples / stories** | `docs/`, `examples/`, `stories/` | [@AIMindCrafter](https://github.com/AIMindCrafter) (triage + review) | QUICKSTART, tool examples, production stories, adopters-adjacent docs |

## What area owners do

1. **Triage** issues labeled `docs`, `story`, or `good first issue` that touch their paths
2. **Review** PRs that only change those paths (approve, request changes, or ping maintainer)
3. **Unstick** stale “I'll take this” claims after ~14 days with no PR (comment + free the issue)
4. **Escalate** anything that changes scoring, safety, npm publish, or CI to the maintainer

## What they do *not* need to do

- Merge to `main` alone if branch rules require maintainer approval
- Own npm releases or security advisories ([SECURITY.md](../SECURITY.md))
- Review `tools/` CLI changes unless they ask

## Becoming an area owner

Multi-PR track record in the area + public invite from the maintainer. Start with [CONTRIBUTING.md](../CONTRIBUTING.md) and the [contributor quickstart](https://github.com/cobusgreyling/loop-engineering/discussions/123).

CODEOWNERS file: [../CODEOWNERS](../CODEOWNERS).
