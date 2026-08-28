# Loop Engineering

<p align="center">
  <a href="https://cobusgreyling.github.io/loop-engineering/"><img src="https://img.shields.io/badge/✨_Showcase-live-3ee8c5?style=for-the-badge&labelColor=111a28" alt="Showcase" /></a>
  <a href="https://github.com/cobusgreyling/loop-engineering/stargazers"><img src="https://img.shields.io/github/stars/cobusgreyling/loop-engineering?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@cobusgreyling/loop"><img src="https://img.shields.io/npm/v/@cobusgreyling/loop?label=loop" alt="loop npm"></a>
  <a href="https://raw.githubusercontent.com/cobusgreyling/loop-engineering/main/docs/last-run.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/cobusgreyling/loop-engineering/main/docs/last-run.json" alt="last triage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
</p>

<p align="center">
  <a href="https://cobusgreyling.github.io/loop-engineering/">
    <img src="https://cdn.jsdelivr.net/gh/cobusgreyling/loop-engineering@main/assets/visuals/loop-engineering-logo.svg" alt="Loop Engineering logo" width="72" />
  </a>
</p>

> **Stop prompting. Design the loop. Get a score.**

<p align="center"><strong>Start in 5 minutes</strong> ·
  <a href="docs/QUICKSTART.md">Quickstart</a> ·
  <a href="docs/jobs.md">What do you want to do?</a> ·
  <a href="docs/refactor.md">Refactor path</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="https://cobusgreyling.github.io/loop-engineering/#interactive">Pattern picker</a>
</p>

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

`--tool` defaults to `claude` if you omit it. Swap for `grok`, `codex`, or `opencode`. Week one is **report-only**.

<p align="center">
  <a href="docs/QUICKSTART.md">
    <img src="https://cdn.jsdelivr.net/gh/cobusgreyling/loop-engineering@main/assets/visuals/loop-audit-demo.gif" alt="Loop Ready score climbing" width="100%" />
  </a>
</p>

You design a system that discovers work, hands it to agents, verifies results, and persists state — instead of typing the next prompt yourself.

**New here?** [Quickstart](docs/QUICKSTART.md) · [Refactor a project](docs/refactor.md) · [Thin GitHub Action loop](starters/thin-loop/) (no `STATE.md` required)

## What do you want to do?

This is a **pattern library for operating agents around a codebase**. It is not a “rewrite the module” button.

| I want to… | Start here |
|------------|------------|
| Keep the repo healthy (issues, CI, deps) | [Quickstart](docs/QUICKSTART.md) → `daily-triage` |
| Land and babysit PRs | [PR Babysitter](patterns/pr-babysitter.md) |
| Run a loop in GitHub Actions with almost no files | [Thin loop](starters/thin-loop/) |
| **Ship a feature or refactor** (todos → small PRs) | **[Refactor / change path](docs/refactor.md)** |

Full jobs table: [docs/jobs.md](docs/jobs.md).

## Patterns

| Pattern | Cadence | Week 1 | Cost |
|---------|---------|--------|------|
| [Daily Triage](patterns/daily-triage.md) | 1d–2h | L1 report | Low |
| [Thin loop](patterns/thin-loop.md) | event + 1d | L1 snapshot | Very low |
| [PR Babysitter](patterns/pr-babysitter.md) | 5–15m | L1 watch | High |
| [CI Sweeper](patterns/ci-sweeper.md) | 5–15m | L2 cautious | Very high |
| [Dependency Sweeper](patterns/dependency-sweeper.md) | 6h–1d | L2 patch-only | Medium |
| [Changelog Drafter](patterns/changelog-drafter.md) | 1d or tag | L1 draft | Low |
| [Post-Merge Cleanup](patterns/post-merge-cleanup.md) | 1d–6h | L1 off-peak | Low |
| [Issue Triage](patterns/issue-triage.md) | 2h–1d | L1 propose-only | Low |

Interactive picker: [showcase](https://cobusgreyling.github.io/loop-engineering/#interactive). Index: [patterns/registry.yaml](patterns/registry.yaml).

## Getting started

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
npx @cobusgreyling/loop cost --pattern daily-triage --level L1
```

Empty repo → first `STATE.md` walkthrough: [scripts/empty-to-state-demo.sh](scripts/empty-to-state-demo.sh).

Roll out **L1 report → L2 assisted → L3 unattended** only after the verifier has been right for a week. See [loop-design-checklist](docs/loop-design-checklist.md).

Loop Ready now **weights recent runs harder than files on disk**. A 30-day-old `STATE.md` is not L3.

## Examples by tool

[Claude Code](examples/claude-code/) (including the [plugin](examples/claude-code/plugin.md)) · [Grok](examples/grok/daily-triage.md) · [Codex](examples/codex/) · [OpenClaw](examples/openclaw/daily-triage.md) · [Opencode](examples/opencode/) · [GitHub Actions](examples/github-actions/)

## Operating & safety

[Failure modes](docs/failure-modes.md) · [Anti-patterns](docs/anti-patterns.md) · [Safety](docs/safety.md) · [Operating loops](docs/operating-loops.md) · [Stories](stories/) (wins **and** failures)

Loop engineering amplifies judgment. Token costs can explode. Unattended loops make unattended mistakes. Read what the loop ships.

## Help wanted

Docs and small PRs: first response within **48 hours**.

- [Add your project](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml) to [adopters](docs/adopters.md)
- [Share a story](https://github.com/cobusgreyling/loop-engineering/issues/new?template=share-story.yml) (failures first-class)
- Live [`good first issue`](https://github.com/cobusgreyling/loop-engineering/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) list
- [Show your loop](https://github.com/cobusgreyling/loop-engineering/discussions/326) · [Ask anything](https://github.com/cobusgreyling/loop-engineering/discussions/327)

See [CONTRIBUTING.md](CONTRIBUTING.md).

<details>
<summary>CLI packages and companion repos (optional — not required for week one)</summary>

Unified front door: `npx @cobusgreyling/loop` (`init` · `doctor` · `status` · `audit` · `cost`). Older packages (`loop-init`, `loop-audit`, …) stay supported.

Companions exist for later: [memory-engineering](https://github.com/cobusgreyling/memory-engineering), [harness-foundry](https://github.com/cobusgreyling/harness-foundry), [outerloop](https://github.com/cobusgreyling/outerloop), [fleet-engineering](https://github.com/cobusgreyling/fleet-engineering), [goal-engineering](https://github.com/cobusgreyling/goal-engineering). Do not add them until a loop has actually run.

</details>

## Sources

- [Cobus Greyling — Loop Engineering](https://cobusgreyling.substack.com/p/loop-engineering)
- [Addy Osmani — Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
- [Lulla et al. 2026 — Building Blocks, Adoption, and Impact](https://arxiv.org/abs/2608.21884) (this repo is the community reference they reviewed)
- [Attribution](resources/sources.md)

## License

MIT
