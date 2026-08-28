# Fork outreach — 20 recent forks

Goal: five adopter rows that are not this repo. Do not mass-issue. Personal note, one repo at a time.

## Message (GitHub, email, or X DM)

Hi — you forked loop-engineering. If you actually run a loop (even L1 report-only, even if you dropped STATE.md), I want one row in the adopters list:

https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml

Pattern, tool, level, one line on what worked or broke. Failures preferred. Takes ~10 minutes. We review within 48 hours.

If you forked and never ran it, ignore this.

## How to pick 20

```bash
gh api "repos/cobusgreyling/loop-engineering/forks?sort=newest&per_page=20" \
  --jq '.[] | "\(.pushed_at)\t\(.full_name)\t\(.html_url)"'
```

Prefer forks with `pushed_at` after the fork date (they did something). Skip empty forks.

Snapshot (newest 20 as of 2026-08-28). Many share a `pushed_at` with the parent — those are likely empty forks; skip them.

| pushed_at (UTC) | Fork |
|-----------------|------|
| 2026-08-27 11:17 | https://github.com/Randika97/loop-engineering |
| 2026-08-27 11:17 | https://github.com/nhannguyensy/loop-engineering |
| 2026-08-27 11:17 | https://github.com/Srimalwimalaweera/loop-engineering |
| 2026-08-27 04:02 | https://github.com/Agi-Asi/loop-engineering |
| 2026-08-26 08:22 | https://github.com/laudarch/loop-engineering |
| 2026-08-26 08:22 | https://github.com/tokitam/loop-engineering |
| 2026-08-24 08:13 | https://github.com/itzMalieth/loop-engineering |
| 2026-08-24 08:13 | https://github.com/dleventis/loop-engineering |
| 2026-08-24 08:13 | https://github.com/MartinQuic/loop-engineering |
| 2026-08-24 08:13 | https://github.com/cryptXploit/loop-engineering |
| 2026-08-24 08:13 | https://github.com/FaisalRajpoot1/loop-engineering |
| 2026-08-24 08:13 | https://github.com/jo4josephine/loop-engineering |
| 2026-08-24 02:43 | https://github.com/ufda/loop-engineering |
| 2026-08-24 02:43 | https://github.com/meorstone/loop-engineering |
| 2026-08-23 02:42 | https://github.com/casper05/loop-engineering |
| 2026-08-23 02:42 | https://github.com/domdomsaigon123-collab/loop-engineering |
| 2026-08-23 02:42 | https://github.com/faisalcha/loop-engineering |
| 2026-08-23 02:42 | https://github.com/Tayonike/loop-engineering |
| 2026-08-23 02:42 | https://github.com/lucasboy66/loop-engineering |
| 2026-08-23 02:42 | https://github.com/Joaquin-Boilet/loop-engineering |

Post the same ask on the pinned adopters discussion instead of cold-emailing if a fork has no public email:

https://github.com/cobusgreyling/loop-engineering/discussions/92
