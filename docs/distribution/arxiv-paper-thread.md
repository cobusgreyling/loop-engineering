# Thread — Lulla et al. found 217 loops and almost no STATE.md

Source: https://arxiv.org/abs/2608.21884  
This repo is the community reference they reviewed.

## X (copy-paste)

1/ Researchers scanned 36,710 repos for loop engineering.

They confirmed 217 autonomous agent loops.

Almost none commit STATE.md.

The config is in git. The runtime state is not.

2/ That matches what we see as maintainers of loop-engineering.

We prescribed STATE.md, loop-budget.md, verifier sub-agents.

The paper found: triggers (GitHub Actions) are real. The files we treat as the spine are almost absent.

3/ Most of those 217 loops were event-triggered PR review. The next PR is the next run. There is nothing to persist.

Scheduled loops were mostly issue triage. The issue tracker already holds the backlog.

4/ STATE.md still pays off when you need:

- attempt counts
- a watch list that is not an issue
- a kill switch and a budget the agent can read
- a human who was not in the last session

If GitHub already is the queue, do not invent a second one.

5/ We shipped a Thin Loop starter for the common case: one Action, job summary, optional comment. No STATE.md.

`npx @cobusgreyling/loop init . --pattern thin-loop --tool claude`

And Loop Ready now treats a 14-day-old Last run as stale, not L3.

6/ Paper: https://arxiv.org/abs/2608.21884

Repo: https://github.com/cobusgreyling/loop-engineering

If you run a loop that does commit state, add it to adopters. The empirical gap is still huge.

## LinkedIn (one post)

An ASE workshop paper (Lulla, Nersesyan, Mohsenimofidi, Treude, Baltes) mined 36k GitHub repos for loop engineering. 217 loops confirmed. Almost no project commits the state files the discourse (including our repo) prescribed.

Takeaway for practitioners: match the loop to the store you already have. PR review loops can stay in GitHub Actions + comments. Use STATE.md when the queue is not the tracker.

We changed the reference repo to match: a thin-loop starter, and Loop Ready that scores recent runs instead of template files.

https://arxiv.org/abs/2608.21884
https://github.com/cobusgreyling/loop-engineering
