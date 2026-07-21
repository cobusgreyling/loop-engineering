# PR Babysitter Starter

Scaffold for the [PR Babysitter](../../patterns/pr-babysitter.md) loop (L2 — assisted fixes with verifier).

## Quick Start

1. Copy into your repo:
   ```bash
   npx @cobusgreyling/loop-init . --pattern pr-babysitter --tool grok
   # Or manual:
   cp -r starters/pr-babysitter/.grok/skills/* .grok/skills/
   cp starters/pr-babysitter/pr-babysitter-state.md.example pr-babysitter-state.md
   cp starters/pr-babysitter/LOOP.md .
   ```

2. Customize skills with your review norms and required checks.

3. Start (Grok):
   ```bash
   /loop 5m Check open PRs. Update pr-babysitter-state.md. For CI failures or actionable review comments on allowlisted PRs: worktree + minimal-fix + loop-verifier. Run loop-context --check before each retry; run loop-gate check before commit. Never merge — propose only. Escalate after 3 attempts per PR.
   ```

4. Sign PR comments: `🤖 Loop Engineering — PR Babysitter`

## Files

| File | Purpose |
|------|---------|
| `pr-babysitter-state.md.example` | Watcher state |
| `.grok/skills/pr-review-triage/` | PR triage skill |
| `LOOP.md` | Team loop config |

## Safety

- No auto-merge by default
- Denylist: auth, payments, secrets — see [safety.md](../../docs/safety.md)