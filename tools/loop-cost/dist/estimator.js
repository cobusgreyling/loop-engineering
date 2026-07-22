export const VALID_READINESS_LEVELS = ['L1', 'L2', 'L3'];
export function assertValidLevel(level) {
    if (!VALID_READINESS_LEVELS.includes(level)) {
        throw new Error(`Invalid level: ${level}. Valid: ${VALID_READINESS_LEVELS.join(', ')}`);
    }
}
/**
 * Parse an orchestration spec into a multiplier on the action path.
 *
 * The action path (implementer + verifier work) is where multi-agent
 * orchestration lands; the no-op scan and single triage pass are unaffected.
 *
 *   single         1x   one implementer pass, self-checked (default)
 *   maker-checker  2x   implementer + an independent verifier pass
 *   parallel:N     N+1  N candidate agents fan out, plus a merge/arbiter pass
 *   debate:R       1+R  one proposer plus R critique-and-revise rounds
 */
export function parseOrchestration(spec) {
    const s = (spec ?? 'single').trim().toLowerCase();
    if (s === '' || s === 'single')
        return { mode: 'single', multiplier: 1 };
    if (s === 'maker-checker')
        return { mode: 'maker-checker', multiplier: 2 };
    const parallel = s.match(/^parallel:(\d+)$/);
    if (parallel) {
        const n = Number(parallel[1]);
        if (n < 2)
            throw new Error(`Invalid orchestration: parallel:N needs N>=2 (got ${n}).`);
        return { mode: `parallel:${n}`, multiplier: n + 1 };
    }
    const debate = s.match(/^debate:(\d+)$/);
    if (debate) {
        const r = Number(debate[1]);
        if (r < 1)
            throw new Error(`Invalid orchestration: debate:R needs R>=1 (got ${r}).`);
        return { mode: `debate:${r}`, multiplier: 1 + r };
    }
    throw new Error(`Invalid orchestration: ${spec}. Valid: single, maker-checker, parallel:N, debate:R`);
}
const INTERVAL_MS = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};
export function parseInterval(token) {
    const m = token.match(/^(\d+)([mhd])$/);
    if (!m)
        throw new Error(`Invalid cadence interval: ${token}`);
    const unit = m[2];
    return Number(m[1]) * INTERVAL_MS[unit];
}
/** Runs per day for a single interval like 15m or 1d. */
export function runsPerDayForInterval(interval) {
    const ms = parseInterval(interval);
    return Math.floor(86_400_000 / ms);
}
/**
 * Parse pattern cadence (e.g. 5m-15m, 1d-2h) into runs/day.
 * conservative=true picks the slower cadence in a range.
 */
export function cadenceToRunsPerDay(cadence, conservative = false) {
    const parts = cadence.split('-').map((p) => p.trim());
    if (parts.length === 1)
        return runsPerDayForInterval(parts[0]);
    const runs = parts.map(runsPerDayForInterval);
    return conservative ? Math.min(...runs) : Math.max(...runs);
}
function realisticMix(level, earlyExitRequired) {
    if (level === 'L1') {
        return {
            noop: earlyExitRequired ? 0.9 : 0.6,
            report: earlyExitRequired ? 0.1 : 0.4,
            action: 0,
            assumptions: earlyExitRequired
                ? 'L1: 90% early-exit, 10% full triage'
                : 'L1: 60% no-op, 40% full triage',
        };
    }
    if (level === 'L2') {
        return {
            noop: earlyExitRequired ? 0.85 : 0.5,
            report: earlyExitRequired ? 0.1 : 0.3,
            action: earlyExitRequired ? 0.05 : 0.2,
            assumptions: earlyExitRequired
                ? 'L2: 85% early-exit, 10% triage, 5% implementer+verifier'
                : 'L2: 50% no-op, 30% triage, 20% action',
        };
    }
    return {
        noop: 0.4,
        report: 0.35,
        action: 0.25,
        assumptions: 'L3: 40% no-op, 35% triage, 25% action (unattended — monitor closely)',
    };
}
function formatTokens(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${Math.round(n / 1_000)}k`;
    return String(n);
}
// Anthropic prompt caching: cache reads bill at roughly 10% of base input
// token cost. Only the stable portion of a run's tokens (STATE.md, skills,
// system prompt — unchanged since the last cache write) benefit; the
// variable portion (fresh scan results, diffs) still costs full price.
const CACHE_READ_DISCOUNT = 0.1;
function applyCaching(tokensPerRun, stableFraction) {
    const stable = tokensPerRun * stableFraction;
    const variable = tokensPerRun - stable;
    return Math.round(variable + stable * CACHE_READ_DISCOUNT);
}
export function estimateCost(input) {
    assertValidLevel(input.level);
    const cadence = input.cadence ?? input.pattern.cadence;
    const runsPerDay = cadenceToRunsPerDay(cadence, input.conservative);
    const { cost, token_cost: tokenCostTier } = input.pattern;
    const mix = realisticMix(input.level, cost.early_exit_required);
    const orchestration = parseOrchestration(input.orchestration);
    // Orchestration overhead lands on the action path only — the no-op scan and
    // the single triage pass do not fan out.
    const actionPerRun = Math.round(cost.tokens_action * orchestration.multiplier);
    const noopDay = cost.tokens_noop * runsPerDay;
    const reportDay = cost.tokens_report * runsPerDay;
    const actionDay = actionPerRun * runsPerDay;
    const realisticPerRun = cost.tokens_noop * mix.noop +
        cost.tokens_report * mix.report +
        actionPerRun * mix.action;
    const realisticDay = Math.round(realisticPerRun * runsPerDay);
    let caching;
    if (input.withCaching && cost.stable_fraction) {
        const cachedPerRun = applyCaching(realisticPerRun, cost.stable_fraction);
        const cachedDay = Math.round(cachedPerRun * runsPerDay);
        const savingsPercent = Math.round((1 - cachedPerRun / realisticPerRun) * 100);
        caching = { tokensPerRun: cachedPerRun, tokensPerDay: cachedDay, savingsPercent };
    }
    const warnings = [];
    if (cost.early_exit_required) {
        warnings.push('Early-exit triage is required — empty watchlist should exit in <5k tokens.');
    }
    if (actionDay > cost.suggested_daily_cap) {
        warnings.push(`Worst case (action every run) exceeds suggested cap (${formatTokens(cost.suggested_daily_cap)}/day).`);
    }
    if (realisticDay > cost.suggested_daily_cap) {
        warnings.push(`Realistic estimate exceeds suggested daily cap — slow cadence or tighten scope.`);
    }
    if (runsPerDay >= 96) {
        warnings.push(`High cadence (${runsPerDay} runs/day) — verify early-exit is working.`);
    }
    if (orchestration.multiplier > 2) {
        warnings.push(`Orchestration ${orchestration.mode} multiplies action cost ${orchestration.multiplier}x — confirm the fan-out or debate depth is justified.`);
    }
    return {
        patternId: input.pattern.id,
        patternName: input.pattern.name,
        cadence,
        level: input.level,
        runsPerDay,
        tokenCostTier,
        suggestedDailyCap: cost.suggested_daily_cap,
        earlyExitRequired: cost.early_exit_required,
        orchestration,
        scenarios: {
            noop: { tokensPerRun: cost.tokens_noop, tokensPerDay: noopDay },
            report: { tokensPerRun: cost.tokens_report, tokensPerDay: reportDay },
            action: { tokensPerRun: actionPerRun, tokensPerDay: actionDay },
            realistic: {
                tokensPerRun: Math.round(realisticPerRun),
                tokensPerDay: realisticDay,
                assumptions: mix.assumptions,
            },
            caching,
        },
        warnings,
    };
}
export function formatEstimateHuman(r) {
    const lines = [];
    lines.push('');
    lines.push(`Loop Cost Estimate — ${r.patternName} (${r.patternId})`);
    lines.push('═'.repeat(50));
    lines.push(`Cadence: ${r.cadence}  →  ${r.runsPerDay} runs/day`);
    lines.push(`Level: ${r.level}  ·  Registry tier: ${r.tokenCostTier}`);
    if (r.orchestration.multiplier > 1) {
        lines.push(`Orchestration: ${r.orchestration.mode}  ·  action x${r.orchestration.multiplier}`);
    }
    lines.push(`Suggested daily cap: ${formatTokens(r.suggestedDailyCap)} tokens`);
    lines.push('');
    lines.push('Daily token estimates:');
    lines.push(`  Early-exit / no-op:  ${formatTokens(r.scenarios.noop.tokensPerDay)}  (${formatTokens(r.scenarios.noop.tokensPerRun)}/run)`);
    lines.push(`  Full triage:         ${formatTokens(r.scenarios.report.tokensPerDay)}  (${formatTokens(r.scenarios.report.tokensPerRun)}/run)`);
    lines.push(`  Action every run:    ${formatTokens(r.scenarios.action.tokensPerDay)}  (${formatTokens(r.scenarios.action.tokensPerRun)}/run)`);
    lines.push(`  Realistic blend:     ${formatTokens(r.scenarios.realistic.tokensPerDay)}  (${r.scenarios.realistic.assumptions})`);
    if (r.scenarios.caching) {
        lines.push(`  With prompt caching: ${formatTokens(r.scenarios.caching.tokensPerDay)}  (${r.scenarios.caching.savingsPercent}% reduction vs. realistic blend)`);
    }
    if (r.warnings.length) {
        lines.push('');
        lines.push('Warnings:');
        for (const w of r.warnings)
            lines.push(`  ! ${w}`);
    }
    lines.push('');
    lines.push('Docs: docs/operating-loops.md · Scaffold: npx @cobusgreyling/loop-init');
    lines.push('');
    return lines.join('\n');
}
