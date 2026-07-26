---
name: budget-negotiator
description: An advanced skill for L3 autonomous loops. When the token budget nears exhaustion, the agent analyzes its ROI (bugs fixed, PRs merged) and autonomously drafts a negotiation request for a budget increase rather than silently failing.
---

# Budget Negotiator

When you detect that you are nearing your daily token cap (e.g., ≥90% spend) via the `loop-budget` skill or your active context, DO NOT just exit silently. You must negotiate for an extension based on your Return on Investment (ROI).

## Goal

Ensure that critical work is not arbitrarily blocked by token budgets if the loop has demonstrated a high success rate and the remaining work is critical.

## Negotiation Protocol

1. **Calculate ROI**:
   - Read `loop-run-log.md` to determine how many items you have successfully resolved, fixed, or merged today.
   - Read `STATE.md` to identify the severity of the *remaining* actionable items in the `Watch List` or `High Priority` sections.
   
2. **Draft Justification**:
   - If the remaining items are High Priority (e.g., CI is red, P0 bugs, security vulnerabilities), draft a concise business justification.
   - The justification must include:
     - The current spend vs the limit.
     - The exact number of tasks you've successfully completed today.
     - The specific critical issue(s) remaining.
     - A precise request for an extension (e.g., +50k tokens or +20% of the cap).

3. **Escalate to Humans**:
   - Append your request to the **High Priority** section of `STATE.md` with the tag `[BUDGET NEGOTIATION]`.
   - Ensure the request is formatted clearly so a human maintainer can make a quick yes/no decision.
   - Example: 
     `[BUDGET NEGOTIATION] I have burned 95k/100k tokens today. However, I have successfully resolved 4 regressions. There is 1 critical CI failure remaining on the main branch. I request a temporary bump to 150k tokens to resolve it.`
   - Set your internal state to `WAITING_FOR_BUDGET` and safely suspend execution.

4. **Resume**:
   - Do not spawn further sub-agents until you read `loop-budget.md` on a subsequent run and verify that the human has increased your token cap.
