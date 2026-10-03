import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileExists } from '@cobusgreyling/readiness-core';
import { PROOF_FILE, readProof } from './proof.js';
const STATE_FILES = [
    'STATE.md',
    'pr-babysitter-state.md',
    'ci-sweeper-state.md',
    'post-merge-state.md',
    'dependency-sweeper-state.md',
    'changelog-drafter-state.md',
    'issue-triage-state.md',
];
/** Score contribution for each readiness signal (see computeScore). */
const SCORE_WEIGHTS = {
    base: 7,
    stateFile: 18,
    triage: 14,
    loopConfig: 9,
    agentsMd: 9,
    skillsTwoPlus: 14,
    skillsOne: 7,
    verifier: 14,
    safetyLoopMd: 4,
    safetyDoc: 4,
    github: 6,
    githubWorkflows: 4,
    mcp: 3,
    worktree: 3,
    registry: 2,
    budgetDoc: 3,
    runLog: 3,
    loopMdBudget: 2,
    budgetSkill: 2,
    toolScope: 3,
    stallDetection: 3,
    escalation: 3,
    gateYaml: 3,
    constraintsFile: 4,
    constraintsSkill: 2,
    loopActivity: 14,
    /** Harness Runtime (harness-foundry) — stack, lock, sessions, emit, host */
    harnessStack: 4,
    harnessLock: 1,
    harnessSessions: 2,
    harnessEmit: 1,
    harnessHost: 1,
    /** Memory Engineering (memory-tiers.md, memory-budget.md) */
    memoryTiers: 4,
    memoryBudget: 2,
    /** Fleet Engineering (fleet-registry.md, fleet-inbox.md) */
    fleetRegistry: 4,
    fleetInbox: 2,
};
const LEVEL_THRESHOLDS = {
    L1: 38,
    L2: 58,
    L3: 78,
};
const LOOP_SKILL_NAMES = [
    'loop-triage',
    'minimal-fix',
    'loop-verifier',
    'pr-review-triage',
    'ci-triage',
    'post-merge-scan',
    'dependency-triage',
    'rebase-and-clean',
    'changelog-scan',
    'loop-constraints',
    'draft-release-notes',
    'issue-triage',
];
const SAFETY_FILES = ['safety.md', 'docs/safety.md', 'SECURITY.md'];
const MCP_FILES = ['.mcp.json', 'mcp.json', '.mcp/config.json'];
const WORKTREE_HINTS = ['worktree', 'worktrees', 'git worktree'];
const BUDGET_HINTS = [/budget/i, /max tokens/i, /token cap/i, /kill switch/i, /loop-pause-all/i];
// Governance signals (multi-agent safety rubric): least-privilege tool scope,
// stall / no-progress detection, and an explicit human-escalation path.
const TOOL_SCOPE_HINTS = [
    /least[- ]privilege/i,
    /tool scope/i,
    /scoped tools?/i,
    /allow-?list/i,
    /read-only tools?/i,
    /permission scope/i,
];
const STALL_HINTS = [
    /loop-context/i,
    /circuit breaker/i,
    /max attempts/i,
    /no[- ]progress/i,
    /\bstall(ed|s|ing)?\b/i,
    /\bstuck\b/i,
    /same error/i,
];
const ESCALATION_HINTS = [
    /escalat/i,
    /hand[- ]?off/i,
    /human[- ]in[- ]the[- ]loop/i,
    /\bHITL\b/i,
    /human review/i,
    /needs? human/i,
    /stop and ask/i,
    /exit code 2/i,
    /\bexit 2\b/i,
];
const SKILL_DIRS = ['.grok/skills', '.claude/skills', '.codex/skills', 'skills'];
/**
 * A signal file counts only when it has content. Empty and whitespace-only
 * files, and JSON that is just {} or [], are placeholders: `touch` is not setup.
 */
export async function hasContent(p) {
    let text;
    try {
        const info = await stat(p);
        if (!info.isFile())
            return false;
        if (info.size > 64 * 1024)
            return true;
        text = await readFile(p, 'utf8');
    }
    catch {
        return false;
    }
    const trimmed = text.replace(/^﻿/, '').trim();
    if (!trimmed)
        return false;
    if (p.toLowerCase().endsWith('.json')) {
        try {
            const value = JSON.parse(trimmed);
            if (value !== null && typeof value === 'object' && Object.keys(value).length === 0)
                return false;
        }
        catch {
            // Not valid JSON, but still content; other checks judge the format.
        }
    }
    return true;
}
/**
 * Frontmatter with a name and a description: what Claude Code, Codex and Grok
 * need before they will load a skill or subagent. Without it the file is
 * never invoked, whatever it is called.
 */
export function hasSkillFrontmatter(text) {
    const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    if (!m)
        return false;
    return /^name:[ \t]*\S/m.test(m[1]) && /^description:[ \t]*\S/m.test(m[1]);
}
async function isLoadableSkill(p) {
    try {
        return hasSkillFrontmatter(await readFile(p, 'utf8'));
    }
    catch {
        return false;
    }
}
/**
 * A gate.yaml loop-gate can load declares `version: 1` and a denylist. This is
 * a shape check, not a parse; loop-drill's record proves the policy works.
 */
export function looksLikeGatePolicy(text) {
    return /^version:[ \t]*1[ \t]*(?:#.*)?$/m.test(text) && /^denylist:/m.test(text);
}
async function anyFileWithContent(dir, depth, accept) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return false;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isFile() && accept(e.name) && (await hasContent(p)))
            return true;
        if (e.isDirectory() && depth > 0 && (await anyFileWithContent(p, depth - 1, accept)))
            return true;
    }
    return false;
}
async function findSkills(root) {
    const found = new Set();
    const hollow = [];
    // A skill is a directory with a loadable SKILL.md. A bare directory, or a
    // SKILL.md with no frontmatter, used to count just for its name.
    for (const dir of SKILL_DIRS) {
        let entries;
        try {
            entries = await readdir(path.join(root, dir), { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            if (!e.isDirectory())
                continue;
            const rel = `${dir}/${e.name}/SKILL.md`;
            if (await isLoadableSkill(path.join(root, rel)))
                found.add(e.name);
            else
                hollow.push(rel);
        }
    }
    // Claude Code agents and Codex subagents can host the verifier role
    for (const dir of ['.claude/agents', '.codex/agents']) {
        let entries;
        try {
            entries = await readdir(path.join(root, dir), { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            if (!e.isFile())
                continue;
            const base = e.name.replace(/\.(md|toml)$/i, '');
            if (!(base.includes('verifier') || base === 'loop-verifier'))
                continue;
            const rel = `${dir}/${e.name}`;
            const abs = path.join(root, rel);
            const loadable = /\.md$/i.test(e.name) ? await isLoadableSkill(abs) : await hasContent(abs);
            if (loadable)
                found.add('loop-verifier');
            else
                hollow.push(rel);
        }
    }
    // Opencode named agents in opencode.json (or the starter example before rename)
    for (const configName of ['opencode.json', 'opencode.json.example']) {
        const configPath = path.join(root, configName);
        if (!(await fileExists(configPath)))
            continue;
        try {
            const raw = await readFile(configPath, 'utf8');
            const parsed = JSON.parse(raw);
            const agents = parsed.agent ?? {};
            for (const [key, def] of Object.entries(agents)) {
                const name = (def?.name ?? key).toLowerCase();
                if (name.includes('verifier') || key.toLowerCase().includes('verifier')) {
                    found.add('loop-verifier');
                    break;
                }
            }
        }
        catch {
            // ignore invalid JSON
        }
    }
    return { names: [...found], hollow };
}
/**
 * L3 means unattended actions behind gates, so the gate has to be shown to
 * fire, not just to exist: loop-drill must have drilled the current gate.yaml
 * in both directions, and no recorded guardrail may be failing.
 */
export function guardrailsProven(proof) {
    return !!proof && proof.proven.includes('gate') && proof.failed.length === 0;
}
/** Activity older than this does not count toward Loop Ready. */
export const ACTIVITY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
function parseLastRunTimestamp(text) {
    const m = text.match(/Last run:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[T ][0-9:.]+(?:Z|[+-][0-9:]+)?)?)/i);
    if (!m)
        return null;
    const raw = /T|\s/.test(m[1]) ? m[1].replace(' ', 'T') : `${m[1]}T00:00:00Z`;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}
function isFreshTimestamp(d, now = Date.now()) {
    const age = now - d.getTime();
    return age <= ACTIVITY_MAX_AGE_MS && age >= -60_000;
}
async function detectLoopActivity(root) {
    const evidence = [];
    const now = Date.now();
    // 1. Fresh "Last run" timestamps in state files (not the mere presence of the words)
    for (const sf of STATE_FILES) {
        try {
            const p = path.join(root, sf);
            if (!(await fileExists(p)))
                continue;
            const txt = await readFile(p, 'utf8');
            const when = parseLastRunTimestamp(txt);
            if (when && isFreshTimestamp(when, now))
                evidence.push(`state:${sf}:fresh`);
        }
        catch { }
    }
    // 2. Dated JSON rows in the run log (file presence alone is not a run)
    try {
        const logPath = path.join(root, 'loop-run-log.md');
        if (await fileExists(logPath)) {
            const txt = await readFile(logPath, 'utf8');
            for (const line of txt.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('{'))
                    continue;
                try {
                    const row = JSON.parse(trimmed);
                    if (!row.run_id)
                        continue;
                    const when = new Date(row.run_id);
                    if (!Number.isNaN(when.getTime()) && isFreshTimestamp(when, now)) {
                        evidence.push('log:loop-run-log.md:fresh');
                        break;
                    }
                }
                catch {
                    // ignore invalid JSON lines
                }
            }
        }
    }
    catch { }
    // 3. Git history on state / run-log files in the last 14 days — not arbitrary "triage" commit messages
    try {
        const log = execSync('git log --since=14.days --oneline -- STATE.md loop-run-log.md "*state.md" "*-state.md"', {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1500,
        });
        const first = log.trim().split('\n')[0] || '';
        if (first)
            evidence.push(`git:${first.slice(0, 60)}`);
    }
    catch {
        // git not available or not a repo — ignore gracefully
    }
    return { present: evidence.length > 0, evidence: Array.from(new Set(evidence)).slice(0, 4) };
}
export function computeScore(signals) {
    const w = SCORE_WEIGHTS;
    let score = w.base;
    if (signals.stateFile.present)
        score += w.stateFile;
    if (signals.triage.present)
        score += w.triage;
    if (signals.loopConfig.present)
        score += w.loopConfig;
    if (signals.agentsMd.present)
        score += w.agentsMd;
    if (signals.skills.count >= 2)
        score += w.skillsTwoPlus;
    else if (signals.skills.count === 1)
        score += w.skillsOne;
    if (signals.verifier.present)
        score += w.verifier;
    if (signals.safety.loopMdMentionsSafety)
        score += w.safetyLoopMd;
    if (signals.safety.safetyDocPresent)
        score += w.safetyDoc;
    if (signals.github.present)
        score += w.github;
    if (signals.github.workflows)
        score += w.githubWorkflows;
    if (signals.mcp.present)
        score += w.mcp;
    if (signals.worktreeEvidence.present)
        score += w.worktree;
    if (signals.registry.present)
        score += w.registry;
    if (signals.cost.budgetDoc)
        score += w.budgetDoc;
    if (signals.cost.runLog)
        score += w.runLog;
    if (signals.cost.loopMdBudget)
        score += w.loopMdBudget;
    if (signals.cost.budgetSkill)
        score += w.budgetSkill;
    if (signals.governance.toolScope)
        score += w.toolScope;
    if (signals.governance.stallDetection)
        score += w.stallDetection;
    if (signals.governance.escalation)
        score += w.escalation;
    if (signals.governance.gateYaml)
        score += w.gateYaml;
    if (signals.constraints.present)
        score += w.constraintsFile;
    if (signals.constraints.hasConstraintsSkill)
        score += w.constraintsSkill;
    if (signals.loopActivity.present)
        score += w.loopActivity;
    if (signals.harness.stack)
        score += w.harnessStack;
    if (signals.harness.lock)
        score += w.harnessLock;
    if (signals.harness.sessions)
        score += w.harnessSessions;
    if (signals.harness.emit)
        score += w.harnessEmit;
    if (signals.harness.host)
        score += w.harnessHost;
    if (signals.memory.tiers)
        score += w.memoryTiers;
    if (signals.memory.budget)
        score += w.memoryBudget;
    if (signals.fleet.registry)
        score += w.fleetRegistry;
    if (signals.fleet.inbox)
        score += w.fleetInbox;
    score = Math.min(100, Math.max(0, score));
    const costReady = signals.cost.budgetDoc &&
        signals.cost.runLog &&
        signals.cost.loopMdBudget;
    const hasRealActivity = signals.loopActivity.present;
    const proven = guardrailsProven(signals.proof);
    const l3Ready = costReady && hasRealActivity && proven;
    let level = 'L0';
    if (score >= LEVEL_THRESHOLDS.L3 && signals.verifier.present && signals.stateFile.present && l3Ready)
        level = 'L3';
    else if (score >= LEVEL_THRESHOLDS.L2 && signals.triage.present)
        level = 'L2';
    else if (score >= LEVEL_THRESHOLDS.L1 && signals.stateFile.present)
        level = 'L1';
    else
        level = 'L0';
    const assessment = score >= 82 && l3Ready
        ? 'Strong loop readiness — good candidate for L3 with explicit gates.'
        : score >= 82 && !costReady
            ? 'Strong signals but missing cost observability (loop-budget.md, loop-run-log.md, LOOP.md budget) — add before L3.'
            : score >= 82 && !hasRealActivity
                ? 'Strong structure but no proven loop runs yet — run one L1 cycle and commit state before L3.'
                : score >= 82 && !proven
                    ? 'Strong structure but guardrails are unproven — run loop-drill --record and commit loop-drill.json before L3.'
                    : score >= 62
                        ? 'Good foundation — add missing verifier + safety docs for L3.'
                        : score >= 42
                            ? 'Early loop setup — focus on L1 state + triage before enabling actions.'
                            : 'Not loop-ready — start with a starter from this repo (minimal-loop or pr-babysitter).';
    return { score, level, assessment };
}
export async function auditProject(target) {
    const root = path.resolve(target);
    const findings = [];
    const recommendations = [];
    // Every file signal goes through here, so an empty file never scores and is
    // reported instead of silently counted.
    const placeholders = [];
    const present = async (rel) => {
        const p = path.join(root, rel);
        if (await hasContent(p))
            return true;
        if (await fileExists(p))
            placeholders.push(rel);
        return false;
    };
    const statePaths = [];
    for (const f of STATE_FILES) {
        if (await present(f))
            statePaths.push(f);
    }
    const loopMd = await present('LOOP.md');
    const agentsMd = (await present('AGENTS.md')) || (await present('CLAUDE.md'));
    const skillScan = await findSkills(root);
    const skillNames = skillScan.names;
    const proof = await readProof(root);
    const loopSkills = skillNames.filter((s) => LOOP_SKILL_NAMES.includes(s));
    // A verifier loop-drill caught approving seeded defects is Verifier Theater:
    // it earns nothing, whatever its file is called.
    const verifierFound = skillNames.includes('loop-verifier');
    const verifier = verifierFound && !proof.failed.includes('verifier');
    const triage = skillNames.includes('loop-triage') ||
        skillNames.includes('pr-review-triage') ||
        skillNames.includes('ci-triage') ||
        skillNames.includes('dependency-triage') ||
        skillNames.includes('post-merge-scan') ||
        skillNames.includes('changelog-scan') ||
        skillNames.includes('issue-triage');
    let loopMdContent = '';
    if (loopMd) {
        loopMdContent = await readFile(path.join(root, 'LOOP.md'), 'utf8');
    }
    // New expanded signals. A .github/ of empty files is not a dogfooding setup.
    const githubDir = await anyFileWithContent(path.join(root, '.github'), 3, () => true);
    const hasWorkflows = await anyFileWithContent(path.join(root, '.github', 'workflows'), 0, (n) => /\.ya?ml$/i.test(n));
    // Proper safety doc detection
    let safetyDocPresent = false;
    for (const f of SAFETY_FILES) {
        if (await present(f)) {
            safetyDocPresent = true;
            break;
        }
    }
    let mcpConfig = false;
    for (const f of MCP_FILES) {
        if (await present(f)) {
            mcpConfig = true;
            break;
        }
    }
    const mcpPresent = mcpConfig || /MCP|mcp server|plugins & connectors/i.test(loopMdContent);
    // Light evidence of worktree usage (common in patterns/starters/LOOP)
    let worktreeEvidence = false;
    const candidateMd = [
        'LOOP.md',
        'patterns/pr-babysitter.md',
        'starters/minimal-loop/LOOP.md',
        'starters/minimal-loop-claude/LOOP.md',
        'starters/minimal-loop-codex/LOOP.md',
        'docs/operating-loops.md',
    ];
    for (const c of candidateMd) {
        try {
            const p = path.join(root, c);
            if (await fileExists(p)) {
                const txt = await readFile(p, 'utf8');
                if (WORKTREE_HINTS.some(h => txt.toLowerCase().includes(h))) {
                    worktreeEvidence = true;
                    break;
                }
            }
        }
        catch { }
    }
    const registryPresent = await present('patterns/registry.yaml');
    const budgetDoc = await present('loop-budget.md');
    const runLog = await present('loop-run-log.md');
    const loopMdBudget = BUDGET_HINTS.some((re) => re.test(loopMdContent));
    // findSkills only lists skills with a loadable SKILL.md.
    const budgetSkill = skillNames.includes('loop-budget');
    const loopActivity = await detectLoopActivity(root);
    const constraintsFile = await present('loop-constraints.md');
    const constraintsSkill = skillNames.includes('loop-constraints');
    // Governance corpus: docs where scope / stall / escalation rules are written.
    let governanceCorpus = loopMdContent;
    for (const f of ['docs/safety.md', 'safety.md', 'SECURITY.md', 'loop-constraints.md']) {
        const p = path.join(root, f);
        if (await fileExists(p)) {
            try {
                governanceCorpus += '\n' + (await readFile(p, 'utf8'));
            }
            catch { }
        }
    }
    // allowed-tools frontmatter in any SKILL.md is a concrete least-privilege signal.
    let skillDeclaresTools = false;
    const skillScanDirs = [
        path.join(root, '.grok', 'skills'),
        path.join(root, '.claude', 'skills'),
        path.join(root, '.codex', 'skills'),
        path.join(root, 'skills'),
    ];
    for (const dir of skillScanDirs) {
        if (skillDeclaresTools)
            break;
        if (!(await fileExists(dir)))
            continue;
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                if (!e.isDirectory())
                    continue;
                const sp = path.join(dir, e.name, 'SKILL.md');
                if (await fileExists(sp)) {
                    const txt = await readFile(sp, 'utf8');
                    if (/allowed-tools\s*:/i.test(txt)) {
                        skillDeclaresTools = true;
                        break;
                    }
                }
            }
        }
        catch { }
    }
    const toolScope = skillDeclaresTools || TOOL_SCOPE_HINTS.some((re) => re.test(governanceCorpus));
    // loop-context is this repo's circuit breaker; its ledger is direct proof of stall handling.
    let ledgerPresent = false;
    try {
        const rootEntries = await readdir(root, { withFileTypes: true });
        ledgerPresent = rootEntries.some((e) => e.isFile() && /ledger/i.test(e.name));
    }
    catch { }
    const stallClaimed = skillNames.includes('loop-context') ||
        skillNames.includes('loop-guard') ||
        ledgerPresent ||
        STALL_HINTS.some((re) => re.test(governanceCorpus));
    const stallDetection = stallClaimed && !proof.failed.includes('breaker');
    const escalation = ESCALATION_HINTS.some((re) => re.test(governanceCorpus));
    // gate.yaml must look like a policy, and must not be one loop-drill found
    // broken: failing, or impossible to drill at all (loop-gate refused it).
    let gatePolicy = false;
    if (await present('gate.yaml')) {
        gatePolicy = looksLikeGatePolicy(await readFile(path.join(root, 'gate.yaml'), 'utf8'));
    }
    const gateYaml = gatePolicy && !proof.failed.includes('gate') && !proof.untested.includes('gate');
    // Harness Runtime (harness-foundry) — versioned stack, sessions/traces, outerloop emit, host bridge
    const foundryStackPath = path.join(root, '.foundry', 'stack.yaml');
    const harnessStack = await present('.foundry/stack.yaml');
    const harnessLock = (await present('.foundry/stack.lock')) || (await present('.foundry/stack.lock.yaml'));
    let harnessSessions = false;
    const sessionsDir = path.join(root, '.foundry', 'sessions');
    if (await fileExists(sessionsDir)) {
        try {
            const entries = await readdir(sessionsDir, { withFileTypes: true });
            harnessSessions = entries.some((e) => e.isDirectory() || (e.isFile() && e.name !== '.gitkeep'));
        }
        catch {
            harnessSessions = false;
        }
    }
    let harnessEmit = false;
    if (harnessStack) {
        try {
            const stackTxt = await readFile(foundryStackPath, 'utf8');
            if (/emit\/outerloop-evidence|outerloop/i.test(stackTxt))
                harnessEmit = true;
        }
        catch { }
    }
    if (!harnessEmit && (await present('.foundry/hooks/outerloop.yaml'))) {
        harnessEmit = true;
    }
    const harnessHost = (await fileExists(path.join(root, '.foundry', 'host', 'cursor'))) ||
        (await fileExists(path.join(root, '.foundry', 'host', 'claude-code'))) ||
        (await present('.cursor/rules/foundry.mdc')) ||
        (await present('.claude/foundry.md')) ||
        /foundry host integrate|harness-foundry/i.test(loopMdContent);
    const harness = {
        stack: harnessStack,
        lock: harnessLock,
        sessions: harnessSessions,
        emit: harnessEmit,
        host: harnessHost,
    };
    // Memory Engineering (memory-tiers.md, memory-budget.md)
    const memoryTiers = await present('memory-tiers.md');
    const memoryBudget = await present('memory-budget.md');
    const memory = { tiers: memoryTiers, budget: memoryBudget };
    // Fleet Engineering (fleet-registry.md, fleet-inbox.md)
    const fleetRegistry = await present('fleet-registry.md');
    const fleetInbox = await present('fleet-inbox.md');
    const fleet = { registry: fleetRegistry, inbox: fleetInbox };
    const signals = {
        stateFile: { present: statePaths.length > 0, paths: statePaths },
        loopConfig: { present: loopMd, path: loopMd ? 'LOOP.md' : undefined },
        skills: { count: loopSkills.length, loopSkills },
        verifier: { present: verifier },
        triage: { present: triage },
        agentsMd: { present: agentsMd },
        patterns: { documented: loopMd },
        safety: { loopMdMentionsSafety: /gate|denylist|auto-merge|safety/i.test(loopMdContent), safetyDocPresent },
        starters: { used: loopSkills.includes('loop-triage') },
        github: { present: githubDir, workflows: hasWorkflows },
        mcp: { present: mcpPresent },
        constraints: { present: constraintsFile, hasConstraintsSkill: constraintsSkill },
        worktreeEvidence: { present: worktreeEvidence },
        registry: { present: registryPresent },
        cost: { budgetDoc, runLog, loopMdBudget, budgetSkill },
        governance: { toolScope, stallDetection, escalation, gateYaml },
        loopActivity,
        harness,
        memory,
        fleet,
        proof,
    };
    const thinLoopWorkflow = await present('.github/workflows/thin-loop.yml');
    if (placeholders.length > 0 || skillScan.hollow.length > 0) {
        const hollow = [...new Set([...placeholders, ...skillScan.hollow])];
        findings.push({
            level: 'warn',
            message: `Not counted — empty, or a skill/agent without name + description frontmatter: ${hollow.join(', ')}.`,
        });
        recommendations.push('Fill in or delete placeholder files; a skill needs a SKILL.md with name and description frontmatter to load');
    }
    if (!signals.stateFile.present) {
        if (thinLoopWorkflow) {
            findings.push({
                level: 'warn',
                message: 'No STATE.md — acceptable for a thin loop if GitHub issues/PRs are the spine. Add STATE.md when findings must persist across runs.',
            });
        }
        else {
            findings.push({ level: 'fail', message: 'No state file (STATE.md or pattern-specific state).' });
            recommendations.push('Copy starters/minimal-loop/STATE.md.example (or -claude / -codex variant) to STATE.md — or scaffold starters/thin-loop if the tracker is the state');
        }
    }
    else {
        findings.push({ level: 'ok', message: `State file(s): ${statePaths.join(', ')}` });
        for (const sf of statePaths) {
            try {
                const txt = await readFile(path.join(root, sf), 'utf8');
                const when = parseLastRunTimestamp(txt);
                if (when && !isFreshTimestamp(when)) {
                    findings.push({
                        level: 'warn',
                        message: `${sf} Last run is older than 14 days — files on disk are not loop activity.`,
                    });
                    recommendations.push(`Run the loop and commit ${sf} (or append loop-run-log.md) so Loop Ready can see a fresh timestamp`);
                }
            }
            catch { }
        }
    }
    if (!signals.triage.present) {
        findings.push({ level: 'warn', message: 'No triage skill detected.' });
        recommendations.push('Install loop-triage from starters/minimal-loop, minimal-loop-claude, or minimal-loop-codex');
    }
    else {
        findings.push({ level: 'ok', message: 'Triage skill present.' });
    }
    if (verifierFound && !verifier) {
        findings.push({
            level: 'fail',
            message: `Verifier present but loop-drill's canary caught it approving seeded defects (Verifier Theater) — not counted: ${proof.failures.filter((id) => id.startsWith('verifier')).join(', ')}.`,
        });
        recommendations.push('Make the verifier reject the seeded defects, then rerun: npx @cobusgreyling/loop-drill . --only verifier --verifier-cmd "<cmd>" --record');
    }
    else if (!signals.verifier.present) {
        findings.push({ level: 'warn', message: 'No loop-verifier skill — maker/checker split incomplete.' });
        recommendations.push('Add verifier: .grok/skills/loop-verifier, .claude/agents/loop-verifier.md, .codex/agents/verifier.toml, or a verifier agent in opencode.json');
    }
    else {
        findings.push({ level: 'ok', message: 'Verifier skill present.' });
    }
    if (!signals.loopConfig.present) {
        findings.push({ level: 'warn', message: 'No LOOP.md documenting cadence, limits, and gates.' });
        recommendations.push('Copy starters/minimal-loop/LOOP.md and customize');
    }
    if (!signals.agentsMd.present) {
        findings.push({ level: 'warn', message: 'No AGENTS.md / CLAUDE.md for project conventions.' });
        recommendations.push('Add AGENTS.md with build/test commands and review norms');
    }
    if (!signals.safety.loopMdMentionsSafety) {
        findings.push({ level: 'warn', message: 'LOOP.md does not mention safety gates or auto-merge policy.' });
        recommendations.push('Document human gates per docs/safety.md in LOOP.md');
    }
    if (!signals.safety.safetyDocPresent) {
        findings.push({ level: 'warn', message: 'No safety.md or docs/safety.md found.' });
        recommendations.push('Copy or create docs/safety.md (denylists, auto-merge policy, MCP scopes)');
    }
    else {
        findings.push({ level: 'ok', message: 'Safety documentation present.' });
    }
    if (!signals.constraints.present) {
        findings.push({ level: 'warn', message: 'No loop-constraints.md — structured constraints file missing.' });
        recommendations.push('Create loop-constraints.md with denylist paths, push/merge rules, and human gates (see templates/loop-constraints.md)');
    }
    else {
        findings.push({ level: 'ok', message: 'loop-constraints.md present.' });
    }
    if (signals.constraints.present && !signals.constraints.hasConstraintsSkill) {
        findings.push({ level: 'warn', message: 'loop-constraints.md exists but no loop-constraints skill — rules not enforced at runtime.' });
        recommendations.push('Add loop-constraints skill via loop-init or templates/SKILL.md.loop-constraints');
    }
    if (!signals.github.present) {
        findings.push({ level: 'warn', message: 'No .github/ directory (templates, workflows for dogfooding).' });
        recommendations.push('Add .github/ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE, and workflows (see this repo for examples)');
    }
    else if (!signals.github.workflows) {
        findings.push({ level: 'warn', message: '.github/ exists but no workflows/ (CI dogfood opportunity).' });
        recommendations.push('Add GitHub Actions that run loop-audit and validate patterns (dogfood the reference)');
    }
    else {
        findings.push({ level: 'ok', message: '.github/ with workflows present (strong dogfooding signal).' });
    }
    if (!signals.mcp.present) {
        findings.push({ level: 'warn', message: 'No MCP / connector config or mentions detected.' });
        recommendations.push('Document MCP usage (or note "MCP not required for this pattern") in LOOP.md or skills');
    }
    if (!signals.worktreeEvidence.present) {
        findings.push({ level: 'warn', message: 'Little evidence of worktree usage in docs or state.' });
        recommendations.push('Add worktree isolation notes to LOOP.md or pattern docs (see primitives and starters)');
    }
    if (!signals.registry.present) {
        findings.push({ level: 'warn', message: 'No patterns/registry.yaml (machine-readable index for future tools).' });
        recommendations.push('Add patterns/registry.yaml following the existing format');
    }
    if (!signals.cost.budgetDoc) {
        findings.push({ level: 'warn', message: 'No loop-budget.md — token caps and kill switch undocumented.' });
        recommendations.push('Scaffold with loop-init or copy templates/loop-budget.md.template');
    }
    else {
        findings.push({ level: 'ok', message: 'loop-budget.md present.' });
    }
    if (!signals.cost.runLog) {
        findings.push({ level: 'warn', message: 'No loop-run-log.md — run history not persisted.' });
        recommendations.push('Copy templates/loop-run-log.md.template to loop-run-log.md');
    }
    else {
        findings.push({ level: 'ok', message: 'loop-run-log.md present.' });
    }
    if (!signals.cost.loopMdBudget) {
        findings.push({ level: 'warn', message: 'LOOP.md does not mention budget, token caps, or kill switch.' });
        recommendations.push('Add a Budget section to LOOP.md (see starters/*/LOOP.md)');
    }
    if (!signals.cost.budgetSkill) {
        findings.push({ level: 'warn', message: 'No loop-budget skill — budget checks are not automated at runtime.' });
        recommendations.push('Add loop-budget skill via loop-init or templates/SKILL.md.loop-budget');
    }
    else {
        findings.push({ level: 'ok', message: 'loop-budget skill present.' });
    }
    if (!signals.governance.toolScope) {
        findings.push({ level: 'warn', message: 'No least-privilege tool scope — skills/agents may hold broader tool or MCP access than their role needs.' });
        recommendations.push('Declare allowed-tools in SKILL.md frontmatter, or document tool/MCP scopes in docs/safety.md (least privilege per role)');
    }
    else {
        findings.push({ level: 'ok', message: 'Tool/MCP scope constrained (least-privilege signal present).' });
    }
    // An empty gate.yaml is already listed as a placeholder; only judge one with content.
    const gateHasContent = (await fileExists(path.join(root, 'gate.yaml'))) && !placeholders.includes('gate.yaml');
    if (gatePolicy && proof.failed.includes('gate')) {
        findings.push({
            level: 'fail',
            message: `gate.yaml present but loop-drill shows it does not hold — not counted: ${proof.failures.filter((id) => id.startsWith('gate')).join(', ')}.`,
        });
        recommendations.push('Fix gate.yaml so the failing drills pass, then rerun: npx @cobusgreyling/loop-drill . --record');
    }
    else if (gatePolicy && proof.untested.includes('gate')) {
        findings.push({
            level: 'fail',
            message: `gate.yaml present but loop-drill could not drill it — not counted${proof.skipReasons.gate ? `: ${proof.skipReasons.gate}` : '.'}`,
        });
        recommendations.push('Give gate.yaml a non-empty denylist that loop-gate accepts (see templates/gate.yaml.template), then rerun loop-drill --record');
    }
    else if (gateHasContent && !gatePolicy) {
        findings.push({
            level: 'fail',
            message: 'gate.yaml is not a gate policy (needs `version: 1` and a `denylist:`) — loop-gate would refuse to load it. Not counted.',
        });
        recommendations.push('Replace gate.yaml with templates/gate.yaml.template and customize the denylist');
    }
    else if (!signals.governance.gateYaml) {
        findings.push({
            level: 'warn',
            message: 'No gate.yaml — explicit human approval gates are not defined for loop-sync.',
        });
        recommendations.push('Add gate.yaml to define explicit human approval gates.');
    }
    else {
        findings.push({ level: 'ok', message: 'gate.yaml present (human gates defined).' });
    }
    // Proof that guardrails fire, from loop-drill --record.
    if (proof.error) {
        findings.push({ level: 'warn', message: `${PROOF_FILE} is unreadable (${proof.error}) — no guardrail counts as proven.` });
        recommendations.push(`Regenerate it: npx @cobusgreyling/loop-drill . --record`);
    }
    else if (!proof.present) {
        findings.push({
            level: 'warn',
            message: `No ${PROOF_FILE} — guardrails are present but unproven. Nothing shows the gate blocks a sensitive path or the verifier rejects a bad change.`,
        });
        recommendations.push(`Prove the guardrails fire, then commit the record: npx @cobusgreyling/loop-drill . --record`);
    }
    else {
        if (proof.proven.length > 0) {
            findings.push({ level: 'ok', message: `Guardrails proven by loop-drill: ${proof.proven.join(', ')}.` });
        }
        const failedElsewhere = proof.failed.filter((g) => g !== 'gate' && g !== 'verifier');
        if (failedElsewhere.length > 0) {
            findings.push({
                level: 'fail',
                message: `loop-drill shows guardrails failing to fire: ${failedElsewhere.join(', ')} (${proof.failures.filter((id) => failedElsewhere.some((g) => id.startsWith(g))).join(', ')}).`,
            });
            recommendations.push('Fix the failing guardrails, then rerun: npx @cobusgreyling/loop-drill . --record');
        }
        if (proof.stale.length > 0) {
            findings.push({
                level: 'warn',
                message: `${PROOF_FILE} is out of date for: ${proof.stale.join(', ')} (gate.yaml changed since it was drilled, or a canary is over 30 days old) — not counted.`,
            });
            recommendations.push(`Re-record: npx @cobusgreyling/loop-drill . --record (add --only for canaries you ran before)`);
        }
    }
    if (!signals.governance.stallDetection) {
        findings.push({ level: 'warn', message: 'No stall / no-progress detection — a stuck loop can repeat the same failing action instead of escalating.' });
        recommendations.push('Add loop-context (circuit breaker) or a max-attempts / no-progress rule in LOOP.md that escalates instead of looping');
    }
    else {
        findings.push({ level: 'ok', message: 'Stall / no-progress detection present (circuit breaker or documented rule).' });
    }
    if (!signals.governance.escalation) {
        findings.push({ level: 'warn', message: 'No explicit human-escalation path — the loop has no defined hand-off when stuck or out of scope.' });
        recommendations.push('Document an escalation path in LOOP.md (when to stop and hand to a human; e.g. loop-context exit code 2)');
    }
    else {
        findings.push({ level: 'ok', message: 'Human-escalation path documented.' });
    }
    if (!signals.loopActivity.present) {
        findings.push({ level: 'warn', message: 'No evidence of actual loop runs detected (no "Last run" entries in state, loop-related git activity, or scheduled workflows yet).' });
        recommendations.push('Run one loop (report-only), update + commit STATE.md (or pattern state). This turns structure into proven usage.');
    }
    else {
        findings.push({ level: 'ok', message: `Loop activity detected — real usage signals present (${signals.loopActivity.evidence.length} sources).` });
    }
    if (!signals.harness.stack) {
        findings.push({
            level: 'warn',
            message: 'No harness-foundry stack (.foundry/stack.yaml) — loop is designed but not versioned as a composable harness runtime.',
        });
        recommendations.push('Scaffold a harness: npx @cobusgreyling/loop-init . --with-foundry  (or npx @cobusgreyling/harness-foundry init --from loop-engineering:daily-triage)');
    }
    else {
        findings.push({ level: 'ok', message: 'Harness stack present (.foundry/stack.yaml).' });
        if (!signals.harness.emit) {
            findings.push({
                level: 'warn',
                message: 'Harness stack has no outerloop emit path (emit/outerloop-evidence or .foundry/hooks/outerloop.yaml).',
            });
            recommendations.push('Add emit/outerloop-evidence to the reliability layer, or enable .foundry/hooks/outerloop.yaml');
        }
        else {
            findings.push({ level: 'ok', message: 'Harness emit path to outerloop present.' });
        }
        if (!signals.harness.sessions) {
            findings.push({
                level: 'warn',
                message: 'No harness sessions yet — run foundry once to produce traces.',
            });
            recommendations.push('npx @cobusgreyling/harness-foundry run --goal "Verify harness wiring" then re-audit');
        }
        else {
            findings.push({ level: 'ok', message: 'Harness session/trace evidence present.' });
        }
    }
    if (!signals.memory.tiers) {
        findings.push({
            level: 'warn',
            message: 'No memory-tiers.md — memory engineering tiers are not defined.',
        });
        recommendations.push('Scaffold memory tiers: npx @cobusgreyling/loop-init . --with-memory');
    }
    else {
        findings.push({ level: 'ok', message: 'Memory tiers defined (memory-tiers.md).' });
        if (!signals.memory.budget) {
            findings.push({
                level: 'warn',
                message: 'Memory tiers defined but no memory-budget.md — recall budget is missing.',
            });
            recommendations.push('Add memory-budget.md to cap retrieval costs.');
        }
        else {
            findings.push({ level: 'ok', message: 'Memory budget defined.' });
        }
    }
    if (!signals.fleet.registry) {
        findings.push({
            level: 'warn',
            message: 'No fleet-registry.md — multi-agent populations and roles are not defined.',
        });
        recommendations.push('Scaffold a fleet: npx @cobusgreyling/loop-init . --with-fleet');
    }
    else {
        findings.push({ level: 'ok', message: 'Fleet registry defined (fleet-registry.md).' });
        if (!signals.fleet.inbox) {
            findings.push({
                level: 'warn',
                message: 'Fleet registry defined but no fleet-inbox.md — agents cannot cross-communicate.',
            });
            recommendations.push('Add fleet-inbox.md to enable cross-loop tasks.');
        }
        else {
            findings.push({ level: 'ok', message: 'Fleet inbox defined.' });
        }
    }
    const { score, level, assessment } = computeScore(signals);
    // Companion funnels stay available via --with-foundry / --with-memory / --with-fleet
    // but are not pushed to the top of week-one recommendations.
    const costReady = signals.cost.budgetDoc &&
        signals.cost.runLog &&
        signals.cost.loopMdBudget;
    if (score >= 78 && signals.verifier.present && signals.stateFile.present && !costReady) {
        findings.push({
            level: 'warn',
            message: 'Score qualifies for L3 but cost observability is incomplete — capped at L2 until budget + run log + LOOP.md budget exist.',
        });
    }
    if (score >= 78 && signals.verifier.present && signals.stateFile.present && costReady && !signals.loopActivity.present) {
        findings.push({
            level: 'warn',
            message: 'Score qualifies for L3 but no proven loop activity yet — capped at L2 until you run and commit at least one loop cycle.',
        });
    }
    if (score >= 78 &&
        signals.verifier.present &&
        signals.stateFile.present &&
        costReady &&
        signals.loopActivity.present &&
        !guardrailsProven(proof)) {
        findings.push({
            level: 'warn',
            message: `Score qualifies for L3 but the guardrails are unproven — capped at L2 until ${PROOF_FILE} shows the current gate.yaml passing its drills and no guardrail failing.`,
        });
    }
    return {
        target: root,
        score,
        level,
        assessment,
        signals,
        findings,
        recommendations,
    };
}
