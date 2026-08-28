# Activation checklist (weeks 1–4)

Shipped in the activation PR. Remaining human steps after merge:

## Publish npm (needs tags on `main`)

```bash
git tag loop-v0.2.0
git tag loop-init-v1.7.0
git tag loop-audit-v1.9.0
git push origin loop-v0.2.0 loop-init-v1.7.0 loop-audit-v1.9.0
```

Trusted publishing via `.github/workflows/release-loop.yml` (and siblings). Local `npm whoami` is unauthorized; do not `npm publish` from a laptop.

## Record the video

Script: [empty-to-state-video.md](./empty-to-state-video.md)  
Rehearsal: `bash scripts/empty-to-state-demo.sh`

Swap the README hero GIF when the file is on YouTube/X.

## Post

- [arxiv-paper-thread.md](./arxiv-paper-thread.md) — X + LinkedIn
- [show-hn.md](./show-hn.md) — after tags are live so `npx` is 0.2.0
- [glossary-outreach.md](./glossary-outreach.md) — five outlets
- [fork-outreach.md](./fork-outreach.md) — 20 recent forks, one at a time

## Already done in-repo

- README cut; default `--tool claude`
- `#522` answer lives at [refactor.md](../refactor.md) + [README.zh-CN.md](../../README.zh-CN.md)
- Thin loop starter + last-run badge
- Loop Ready weights fresh runs; companions opt-in
- Claude Code plugin metadata
- Honest 22-run story
