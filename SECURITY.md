# Security Policy

Loop engineering runs unattended automation against your codebase. Treat loops like production operators.

## Reporting vulnerabilities

Report security issues **privately** — do not open public issues for exploitable vulnerabilities.

- **Preferred:** [GitHub private vulnerability reporting](https://github.com/cobusgreyling/loop-engineering/security/advisories/new)
- **Email:** security@cobusgreyling.me (PGP on request)

For general loop safety guidance, see [docs/safety.md](docs/safety.md).

## Unattended automation risks

| Risk | Mitigation |
|------|------------|
| Auto-merge of malicious dependency | Denylist + verifier + no auto-merge week one |
| MCP over-permission | Read-only connectors for L1; scope write to PR comments only |
| Secret exfiltration via prompts | Denylist `.env`, credentials paths; never log secrets in STATE.md; screen turns with `loop-jev guard` |
| Infinite fix loops burning budget | Hard attempt caps; kill switch in LOOP.md |
| Supply-chain in loop-produced PRs | Human review for anything outside allowlist |

## Recommended gates before L3

- [ ] Path denylist documented in LOOP.md
- [ ] Verifier runs tests in isolated worktree
- [ ] No auto-merge without explicit allowlist
- [ ] MCP connectors use least privilege
- [ ] `loop-run-log.md` or equivalent observability
- [ ] `loop-jev guard` on agent input/output if the loop reads untrusted issues/PRs

## Supported versions

| Package | Supported |
|---------|-----------|
| `@cobusgreyling/loop-audit` | Latest release on npm |
| `@cobusgreyling/loop-init` | Latest release on npm |
| Reference repo `main` | Current HEAD |