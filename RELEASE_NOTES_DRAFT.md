# Release notes draft — since `loop-mcp-server-v1.0.0`

**Status:** Published to [Discussions #219](https://github.com/cobusgreyling/loop-engineering/discussions/219) (2026-07-08) and [#241](https://github.com/cobusgreyling/loop-engineering/discussions/241) (2026-07-10 maintenance). Archive copy for the next changelog-drafter run.

**Window:** 2026-07-06 → 2026-07-09

---

## Highlights

### loop-audit 1.6.0 — governance scoring ([#233](https://github.com/cobusgreyling/loop-engineering/pull/233))

Readiness scoring now checks multi-agent safety signals:

- Least-privilege tool scope (`allowed-tools` in skills, scoped MCP)
- Stall / no-progress detection (`loop-context`, circuit breaker, max attempts)
- Human-escalation path (HITL, handoff language in `LOOP.md` / constraints)

Tagged `loop-audit-v1.6.0`.

```bash
npx @cobusgreyling/loop-audit . --suggest
```

### New on npm: `@cobusgreyling/loop-worktree` ([#190](https://github.com/cobusgreyling/loop-engineering/pull/190), [#204](https://github.com/cobusgreyling/loop-engineering/pull/204))

Isolated git worktrees per fix attempt — supports PR Babysitter and CI Sweeper L2 patterns without branch collisions. Tagged `loop-worktree-v1.0.0`.

```bash
npx @cobusgreyling/loop-worktree create --run-id fix-1 --pattern pr-babysitter
npx @cobusgreyling/loop-worktree list
npx @cobusgreyling/loop-worktree cleanup --older-than 24h
```

Thanks [@KhaiTrang1995](https://github.com/KhaiTrang1995).

### Stories

| PR | What shipped |
|----|--------------|
| [#234](https://github.com/cobusgreyling/loop-engineering/pull/234) | CI Sweeper infinite flaky-test failure story |
| [#182](https://github.com/cobusgreyling/loop-engineering/pull/182) | Multi-loop coordination story (@k-anushka14) |

### Docs & examples

| PR | Contributor | What shipped |
|----|-------------|--------------|
| [#217](https://github.com/cobusgreyling/loop-engineering/pull/217) | @Mahizhan-S | MCP server `npx` quickstart in `examples/mcp/` ([#201](https://github.com/cobusgreyling/loop-engineering/issues/201)) |
| [#202](https://github.com/cobusgreyling/loop-engineering/pull/202) | @Mahizhan-S | Gemini CLI appendix in primitives matrix |
| [#206](https://github.com/cobusgreyling/loop-engineering/pull/206) | @Mahizhan-S | Zed appendix in primitives matrix |
| [#208](https://github.com/cobusgreyling/loop-engineering/pull/208) | @Mahizhan-S | Windsurf PR Babysitter example |
| [#183](https://github.com/cobusgreyling/loop-engineering/pull/183) | @k-anushka14 | Opencode constraints example |
| [#185](https://github.com/cobusgreyling/loop-engineering/pull/185) | @k-anushka14 | Aider appendix link in examples index |
| Hermes index + QUICKSTART | @AshayK003 ([#187](https://github.com/cobusgreyling/loop-engineering/pull/187)–[#189](https://github.com/cobusgreyling/loop-engineering/pull/189)) | `examples/hermes/README.md`, QUICKSTART section |
| QUICKSTART `loop-worktree` | maintainer ([#197](https://github.com/cobusgreyling/loop-engineering/issues/197)) | L2 worktree subsection + cheat sheet |

### Philosophy & contributor growth

- KY cut surface philosophy v0.1 ([#179](https://github.com/cobusgreyling/loop-engineering/pull/179)) — thanks [@sololys](https://github.com/sololys)
- `CONTRIBUTORS.md` automation refresh ([#180](https://github.com/cobusgreyling/loop-engineering/pull/180))
- Star-history page redesign ([#205](https://github.com/cobusgreyling/loop-engineering/pull/205))

### Housekeeping

- **Star-history workflow** — opens an auto-merge PR instead of pushing to protected `main`
- **loop-audit publish** — install `sigstore` before npm publish ([#236](https://github.com/cobusgreyling/loop-engineering/pull/236))
- Dependabot bumps: `actions/github-script` 7→9, `@types/node` in loop-audit/loop-init
- Stale branch prune (18+ merged heads deleted 2026-07-10) + doc sync ([#238](https://github.com/cobusgreyling/loop-engineering/pull/238))

---

## npm packages (current)

| Package | Version | Notes |
|---------|---------|-------|
| `@cobusgreyling/loop-audit` | **1.6.0** | Governance scoring — `loop-audit-v1.6.0` |
| `@cobusgreyling/loop-worktree` | **1.0.0** | New — `loop-worktree-v1.0.0` |
| `@cobusgreyling/loop-init` | 1.3.3 | Contributor CTA after scaffold |
| `@cobusgreyling/loop-mcp-server` | 1.0.0 | No change |
| `@cobusgreyling/loop-cost` | 1.0.3 | No change |
| `@cobusgreyling/loop-sync` | 1.0.0 | No change |
| `@cobusgreyling/loop-context` | 1.0.0 | No change |
| `@cobusgreyling/goal-audit` | 1.0.2 | Companion — Goal Engineering stack |

---

## Try it in 5 minutes

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
LOOP_PROJECT_ROOT=. npx @cobusgreyling/loop-mcp-server
```

Week two (L2): pair `loop-worktree` with `loop-context --check` — see [QUICKSTART](docs/QUICKSTART.md#l2-isolated-fix-attempts-loop-worktree).