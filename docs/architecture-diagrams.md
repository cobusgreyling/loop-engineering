# Architecture Diagrams

Deeper, more detailed companions to the [Anatomy of a Loop](../README.md#anatomy-of-a-loop) diagram in the README. Where that one shows the linear shape of a single loop, these show: the actor-level sequence within one run, the states a run moves through, how the three autonomy levels relate, and how the actual tools in `tools/` map onto the [Five Building Blocks + Memory](primitives.md) model.

All diagrams are [Mermaid](https://mermaid.js.org/), rendered natively by GitHub when viewing this file.

## One loop cycle (sequence)

Who talks to whom, in order, within a single run — including the fork between the safe auto-path and the human escalation path.

```mermaid
sequenceDiagram
    actor Eng as Engineer
    participant Sched as Scheduler
    participant Skill as Triage Skill
    participant State as STATE.md / Memory
    participant WT as Worktree
    participant Maker as Implementer Agent
    participant Check as Verifier Agent
    participant MCP as MCP / Git / Tickets
    participant Gate as Human Gate

    Sched->>Skill: Fire pattern (e.g. daily-triage)
    Skill->>State: Read goals + last run + budget
    State-->>Skill: Context snapshot
    Skill->>WT: Create isolated worktree
    WT-->>Skill: worktree path
    Skill->>Maker: Task with skills + constraints
    Maker->>Maker: Implement change in worktree
    Maker->>Check: Hand off patch
    Check->>Check: Run tests + policy gates

    alt Verify pass and budget OK
        Check->>MCP: Open PR or update ticket
        MCP-->>Gate: PR link + summary
        Gate->>Gate: Safe and allowlisted?
        alt Safe auto-path
            Gate->>MCP: Approve merge or leave L1 report
            MCP->>State: Write run outcome
        else Risky or ambiguous
            Gate->>Eng: Escalate with full context
            Eng->>MCP: Decide / override
            MCP->>State: Write decision + outcome
        end
    else Verify fail or budget exceeded
        Check->>State: Log failure mode
        Check->>Eng: Report only, no auto-merge
    end
```

## Run lifecycle (state)

The states one scheduled run moves through, from cadence fire to the final durable log entry.

```mermaid
stateDiagram-v2
    [*] --> Scheduled
    Scheduled --> LoadingContext: cadence fire
    LoadingContext --> BlockedBudget: budget exceeded
    LoadingContext --> RunningTriage: context OK
    RunningTriage --> WorkingInWorktree: task selected
    RunningTriage --> IdleNoop: nothing to do
    WorkingInWorktree --> Verifying: implementer done
    Verifying --> AwaitingHumanGate: verify pass + risky
    Verifying --> Failed: verify fail
    AwaitingHumanGate --> Applied: human or allowlist approve
    AwaitingHumanGate --> Rejected: human reject
    Applied --> Logged
    Failed --> Logged
    Rejected --> Logged
    BlockedBudget --> Logged
    IdleNoop --> Logged
    Logged --> [*]
```

## Autonomy levels L1-L3

How a pattern moves between report-only, assisted, and unattended operation — see [primitives-matrix.md](primitives-matrix.md) for the readiness criteria behind each transition.

```mermaid
stateDiagram-v2
    [*] --> L1_ReportOnly
    L1_ReportOnly --> L2_Assisted: audit score up + human OK
    L2_Assisted --> L3_Unattended: denylist + budget + gates proven
    L3_Unattended --> L2_Assisted: incident or cost spike
    L2_Assisted --> L1_ReportOnly: kill switch
    L3_Unattended --> L1_ReportOnly: kill switch
```

## Stack: primitives + tools

The [Five Building Blocks + Memory](primitives.md) model made concrete: which package in `tools/` implements which primitive, and how they connect.

```mermaid
flowchart TB
    subgraph Human["Engineer / Owner"]
        Design[Design LOOP.md patterns]
        Gate[Human gate + kill switch]
        Review[Read PRs + reports]
    end

    subgraph Control["Control plane"]
        Sched[Automations / Scheduling]
        Patterns[patterns/registry.yaml]
        Cost[loop-cost: estimate spend]
        Jev[loop-jev: route, retrieve, guard, classify]
    end

    subgraph Memory["Durable memory"]
        State[STATE.md]
        LoopDoc[LOOP.md]
        Context[loop-context: prune, inject, circuit breaker]
        Sync[loop-sync]
    end

    subgraph Execution["Execution plane"]
        WT[loop-worktree: isolated attempts + locks]
        Maker[Implementer sub-agent]
        Verifier[Verifier sub-agent]
    end

    subgraph Tooling["CLIs + connectors"]
        Init[loop-init: scaffold]
        Audit[loop-audit: readiness score]
        MCP[MCP server: read-only policy + tools]
    end

    Design --> Patterns
    Init --> State
    Init --> LoopDoc
    Sched --> Patterns
    Patterns --> Cost
    Cost --> Context
    Patterns --> Jev
    Jev --> Maker
    Patterns --> WT
    State <--> Sync
    WT --> Maker
    Maker --> Verifier
    Verifier --> Context
    Context --> Gate
    Jev --> Gate
    Verifier --> MCP
    Gate --> Review
    Audit --> Design
```
