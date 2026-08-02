---
name: budget-negotiator
description: An advanced skill for L3 autonomous loops. When the token budget nears exhaustion, the agent analyzes its ROI and autonomously drafts a negotiation request for a budget increase rather than silently failing.
---

<!--
  NOTE: This template is a mirror of skills/budget-negotiator/SKILL.md.
  Any changes made here must be kept byte-identical to the source skill.
-->

# Budget Negotiator

When you detect that you are nearing your daily token cap (e.g., ≥90% spend) via the `loop-budget` skill, DO NOT just exit silently. You must negotiate for an extension based on your Return on Investment (ROI).

## Goal

Ensure that critical work is not arbitrarily blocked by token budgets if the loop has demonstrated a high success rate and the remaining work is critical.

## Rules & Precedence

- **Precedence**: `budget-negotiator` ONLY activates when `loop-budget` would otherwise hard-exit (i.e. ≥90% spend), and ONLY when there are `High Priority` items remaining. If work is not High Priority, yield to the standard `loop-budget` exit sequence.
- **Safety**: This skill touches L3 (unattended) safety boundaries. See [Safety Boundaries](../../docs/safety.md) for threat models.
- **Strict Cap Limitation**: You are strictly forbidden from self-raising the caps in `loop-budget.md`. A human MUST explicitly edit `loop-budget.md` to increase the cap before you can resume.
- **Human Decline**: If a human declines the negotiation by removing the `[BUDGET NEGOTIATION]` tag without increasing the budget, you must revert to report-only mode and NOT ask again today.
- **Cap the Ask**: You may only request a maximum of **+20% or +50k tokens** per negotiation. You may only negotiate a maximum of **one time per day**.

## Negotiation Protocol

1. **Calculate ROI**:
   - Read `loop-run-log.md` and sum up the `actions_taken`, `outcome` (specifically successes), and `tokens_estimate` fields for today.
   - Read `STATE.md` to identify the severity of the *remaining* actionable items in the `Watch List` or `High Priority` sections.
   
2. **Draft Justification**:
   - If the remaining items are High Priority (e.g., CI is red, P0 bugs, security vulnerabilities), draft a concise business justification.
   - The justification must include:
     - The current spend vs the limit.
     - The exact `actions_taken` count and successful outcomes you've completed today based on the JSON log.
     - The specific critical issue(s) remaining.
     - A precise request for an extension tied to the specific `loop-budget.md` field (e.g., "Requesting +50k tokens for the 'Validate/Audit (CI)' max tokens/day").

3. **Escalate to Humans**:
   - Append your request to the **High Priority** section of `STATE.md` with the tag `[BUDGET NEGOTIATION]`.
   - Ensure the request is formatted clearly so a human maintainer can make a quick yes/no decision.
   - Example: 
     `[BUDGET NEGOTIATION] I have burned 95k/100k tokens for the 'Daily Triage' loop today. However, I have successfully executed 4 actions with a 'fix-proposed' outcome. There is 1 critical CI failure remaining on the main branch. I request a temporary bump of 'Daily Triage' max tokens/day by +50k to resolve it.`
   - Set your internal state to `WAITING_FOR_BUDGET` and safely suspend execution.

4. **Resume**:
   - Do not spawn further sub-agents until you read `loop-budget.md` on a subsequent run and verify that the human has increased your token cap.
