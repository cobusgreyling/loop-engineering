# Multi-Loop Coordination: Daily Triage + PR Babysitter

## Overview

I experimented with running two automation loops at the same time:

- **Daily Triage** – reviews new issues and labels or prioritizes them.
- **PR Babysitter** – monitors pull requests and reminds contributors about reviews or requested changes.

Running both loops together helped distribute responsibilities, but it also introduced coordination challenges.

---

## Patterns and tools used

### Loops

- Daily Triage
- PR Babysitter

### Coordination patterns

- Separation of responsibilities
- Independent state tracking
- Scheduled execution
- Clear ownership of resources

---

## Separating state, schedules, and budgets

To avoid conflicts, each loop maintained its own resources.

### State files

- Daily Triage → `triage-state.json`
- PR Babysitter → `pr-state.json`

Each loop only updated its own state file.

### Schedules

Daily Triage ran every morning.

PR Babysitter ran later in the day after new pull requests were likely to appear.

Staggering schedules reduced overlap.

### Budgets

Each loop had its own execution budget and context window.

This prevented one loop from consuming resources intended for the other.

---

## Failure mode

One issue occurred when both loops reacted to the same pull request.

Daily Triage labeled the PR as needing attention while PR Babysitter generated a reminder at nearly the same time.

This resulted in duplicate notifications.

Another risk was context bleed, where one loop accidentally reused information that belonged to another workflow.

---

## Lesson learned

Running multiple loops works best when every loop has:

- a clearly defined responsibility,
- separate state,
- independent schedules,
- and dedicated resource limits.

Treat each loop as an independent worker that communicates only through well-defined shared information instead of sharing internal state.