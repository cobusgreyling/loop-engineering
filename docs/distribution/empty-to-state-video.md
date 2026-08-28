# Video script — empty repo to first STATE.md (8–10 min)

Record this once. Put the file on the README hero next to (or instead of) the score GIF. The score GIF shows files appearing; this video shows a **run**.

## Setup (before record)

- Clean terminal, 80–100 columns, dark theme.
- Clone of loop-engineering on `main` with `tools/loop-init` and `tools/loop-audit` built, **or** npm (`npx @cobusgreyling/loop`).
- No secrets on screen.

## Shot list

1. **0:00 title card (5s)** — “Empty repo → first STATE.md. Report only.”
2. **0:05 empty dir** — `mkdir demo && cd demo && git init && ls`
3. **0:20 init** — `npx @cobusgreyling/loop init . --pattern daily-triage --tool claude`
   - Pause on Loop Ready score. Say: “This score is files on disk. It is not permission to auto-fix.”
4. **1:30 doctor** — `npx @cobusgreyling/loop doctor .`
   - Point at the top 3 actions.
5. **2:30 STATE.md before a run** — `sed -n '1,16p' STATE.md`
   - Last run is empty/never.
6. **3:30 first loop (Claude Code)** — `/loop 1d $loop-triage — update STATE.md. Report-only week one.`
   - If recording without Claude: run `bash scripts/empty-to-state-demo.sh` from the reference repo and narrate the simulated Last run.
7. **6:00 STATE.md after** — High Priority has one real line. Last run is today’s ISO timestamp.
8. **7:00 commit** — `git add STATE.md && git commit -m "chore(loop): first L1 daily triage"`
   - “This commit is what Loop Ready counts as activity.”
9. **8:00 doctor again** — activity finding is ok.
10. **8:45 closer** — “Do not turn on L2 this week. Read the file tomorrow.”

## Caption (X / LinkedIn / YouTube)

Stop prompting. One command, one report-only loop, one STATE.md.

`npx @cobusgreyling/loop init . --pattern daily-triage --tool claude`

Repo: https://github.com/cobusgreyling/loop-engineering

## If you cannot record this week

Run `bash scripts/empty-to-state-demo.sh` and paste the terminal output into a gist linked from the README. A gist of a real run beats another score GIF.
