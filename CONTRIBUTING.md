# Contributing to Loop Engineering

This repo is a **practical engineering reference**, not a hype collection. We welcome patterns, stories, tool mappings, and honest failure reports.

## Ways to Contribute

| Contribution | Where |
|--------------|-------|
| New loop pattern | `patterns/` + `patterns/registry.yaml` |
| Production story | `stories/` |
| Tool example | `examples/{grok,claude-code,codex,github-actions}/` |
| Skill template | `templates/` |
| Starter kit | `starters/` |
| Doc improvement | `docs/` |

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

- Engineering over hype
- Failures are first-class content
- Tool-agnostic by default; tool-specific in labeled sections

## Community

- **Questions**: [GitHub Discussions](https://github.com/cobusgreyling/loop-engineering/discussions) (preferred) or issue with label `question`
- **Show your loop**: post in Discussions or add a row to [docs/adopters.md](./docs/adopters.md)
- **Good first issues**: look for label [`good first issue`](https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- **Security**: see [SECURITY.md](./SECURITY.md) — do not file public issues for exploitable vulnerabilities

Thank you for helping make this the go-to reference for loop engineering.