## Goal

Add a **loop-swarm** subsection to QUICKSTART so multi-agent consensus sandboxing is discoverable next to `loop-sandbox` / L2 safety tools.

## Files

- `docs/QUICKSTART.md` — short subsection after loop-sandbox (or under L2/L3 safety)
- Cross-link `tools/loop-swarm/README.md` and `docs/safety.md`

## Acceptance criteria

- [ ] Explains sequential multi-agent runs + majority byte-identical consensus in 1–2 paragraphs
- [ ] Shows a copy-paste example: `npx @cobusgreyling/loop-swarm run --count 3 -- <agent-cmd>`
- [ ] Notes limitations (serialized runs, SIGINT, not an OS sandbox) with a link to safety docs
- [ ] Does **not** rewrite the unified `@cobusgreyling/loop` front door

**Estimated time:** ~25–30 minutes

Comment **"I'll take this"** to get assigned.
