# Contributing to Loop Engineering

This repo is a **practical engineering reference**, not a hype collection. We welcome patterns, stories, tool mappings, and honest failure reports.

## Ways to Contribute

| Contribution | Where |
|--------------|-------|
| New loop pattern | `patterns/` + `patterns/registry.yaml` |
| Production story | `stories/` |
| Tool example | `examples/{grok,claude-code,codex,openclaw,opencode,github-actions}/` |
| Skill template | `templates/` |
| Starter kit | `starters/` |
| Doc improvement | `docs/` |

## Contribution ladder

Start small — every merged PR counts.

| Step | Time | What to contribute |
|------|------|-------------------|
| **1** | ~15 min | Typo fix, adopters row, primitives-matrix row, or `examples/README.md` link |
| **2** | ~1 hr | Production story in `stories/` or tool example in `examples/{tool}/` |
| **3** | Half day | New starter, skill template, or MCP cookbook entry |
| **4** | Full day | Full pattern in `patterns/` + `patterns/registry.yaml` entry |

**Fastest paths:** [Add your project to adopters](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml) · [Share a story issue](https://github.com/cobusgreyling/loop-engineering/issues/new?template=share-story.yml) · [`good first issue` backlog](https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

## Pattern Requirements

Every new pattern must include all sections from [templates/pattern-template.md](./templates/pattern-template.md):

1. Goal (one sentence)
2. Scheduling (per-tool commands)
3. Required skills
4. State schema (with example)
5. Typical cycle (numbered steps)
6. Verification strategy (maker/checker)
7. Human handoff points
8. Tool-specific notes (at least 2 tools)
9. Failure modes table
10. Success metrics

Also add an entry to `patterns/registry.yaml`.

## Story Requirements

- Real experience (anonymize if needed)
- Name the pattern used
- Include at least one failure or surprise
- Actionable lesson in one paragraph

## Pull Request Checklist

- [ ] Links work from README or relevant index
- [ ] No secrets, tokens, or internal URLs
- [ ] `STATE.md` examples use `.example` suffix (gitignored live state)
- [ ] Safety-sensitive patterns reference [docs/safety.md](./docs/safety.md)

## Code of Conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md) (Contributor Covenant).

In short:

- Engineering over hype
- Failures are first-class content
- Tool-agnostic by default; tool-specific in labeled sections
- Harassment and bad-faith participation are not tolerated

## Maintainer response (adopters & stories)

PRs that only touch `stories/`, `docs/adopters.md`, or the [Add Adopter](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml) template get **same-day review** when possible:

1. Maintainer merges or requests one small fix within 24 hours
2. Public thank-you on the PR or issue (`@mention` the contributor)
3. Optional follow-up issue if the contributor wants a second PR (e.g. expand story → pattern example)

Automation posts a welcome comment on new story/adopter PRs (see `.github/workflows/welcome-contributors.yml`).

## Community

- **Questions**: [Ask anything](https://github.com/cobusgreyling/loop-engineering/discussions/327) (preferred) or issue with label `question`
- **Show your loop**: [Show your loop](https://github.com/cobusgreyling/loop-engineering/discussions/326), [Add Adopter issue](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml), or a row in [docs/adopters.md](./docs/adopters.md)
- **Loop Ready badge**: `npx @cobusgreyling/loop-audit . --badge` — paste into your README
- **Good first issues**: look for label [`good first issue`](https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- **Hall of fame**: [CONTRIBUTORS.md](./CONTRIBUTORS.md) — regenerate after merges with `npm run contributors:generate`
- **Security**: see [SECURITY.md](./SECURITY.md) — do not file public issues for exploitable vulnerabilities

Thank you for helping make this the go-to reference for loop engineering.
