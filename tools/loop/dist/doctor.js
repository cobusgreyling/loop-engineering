/**
 * loop doctor — single activation check: audit + sync + budget/gate presence.
 * Exit: 0 healthy · 1 warnings · 2 blocked
 */
import path from 'node:path';
import { runToolCapture } from './pass-through.js';
import { budgetPresent, fileExists, findStateFile, readText, } from './files.js';
function parseJsonLoose(stdout) {
    const t = stdout.trim();
    if (!t)
        return null;
    try {
        return JSON.parse(t);
    }
    catch {
        /* Some CLIs may print a banner before JSON — take first object/array */
        const startObj = t.indexOf('{');
        const startArr = t.indexOf('[');
        const candidates = [startObj, startArr].filter((i) => i >= 0);
        if (!candidates.length)
            return null;
        const start = Math.min(...candidates);
        try {
            return JSON.parse(t.slice(start));
        }
        catch {
            return null;
        }
    }
}
export async function runDoctor(target) {
    const root = path.resolve(target);
    const notes = [];
    const actions = [];
    const stateName = await findStateFile(root);
    const loopMd = await fileExists(path.join(root, 'LOOP.md'));
    const budgetPath = path.join(root, 'loop-budget.md');
    const budgetRaw = await readText(budgetPath);
    const runLog = await fileExists(path.join(root, 'loop-run-log.md'));
    const constraints = await fileExists(path.join(root, 'loop-constraints.md'));
    const gate = await fileExists(path.join(root, 'gate.yaml'));
    const agentsMd = await fileExists(path.join(root, 'AGENTS.md'));
    let readyScore = null;
    let readyLevel = null;
    let assessment = null;
    let auditRecs = [];
    const auditRun = await runToolCapture('audit', [root, '--json']);
    if (auditRun.code !== 0 && !auditRun.stdout.trim()) {
        notes.push(`loop-audit failed: ${auditRun.stderr.trim() || `exit ${auditRun.code}`}`);
    }
    else {
        const j = parseJsonLoose(auditRun.stdout);
        if (j && typeof j.score === 'number') {
            readyScore = j.score;
            readyLevel = j.level ?? null;
            assessment = j.assessment ?? null;
            auditRecs = Array.isArray(j.recommendations) ? j.recommendations : [];
        }
        else {
            notes.push('Could not parse loop-audit JSON output');
        }
    }
    let syncScore = null;
    let syncLevel = null;
    let issueCount = 0;
    const syncRun = await runToolCapture('sync', [root, '--json']);
    if (syncRun.code !== 0 && !syncRun.stdout.trim()) {
        notes.push(`loop-sync failed: ${syncRun.stderr.trim() || `exit ${syncRun.code}`}`);
    }
    else {
        const j = parseJsonLoose(syncRun.stdout);
        if (j && typeof j.score === 'number') {
            syncScore = j.score;
            syncLevel = j.level ?? null;
            issueCount = Array.isArray(j.issues) ? j.issues.length : 0;
            if (Array.isArray(j.suggestions)) {
                for (const s of j.suggestions.slice(0, 2)) {
                    actions.push({ priority: 40, text: s });
                }
            }
        }
        else {
            notes.push('Could not parse loop-sync JSON output');
        }
    }
    // Structural actions (highest priority for empty repos)
    if (!stateName && !loopMd) {
        actions.push({
            priority: 1,
            text: 'Scaffold a first loop (report-only week one)',
            command: 'npx @cobusgreyling/loop init . --pattern daily-triage --tool claude',
        });
    }
    else if (!stateName) {
        actions.push({
            priority: 2,
            text: 'Add a state file (STATE.md or pattern state)',
            command: 'npx @cobusgreyling/loop init . --pattern daily-triage --tool claude',
        });
    }
    if (!loopMd) {
        actions.push({
            priority: 3,
            text: 'Add LOOP.md documenting cadence, gates, and kill switch',
        });
    }
    if (!budgetPresent(budgetRaw)) {
        actions.push({
            priority: 10,
            text: 'Add loop-budget.md with daily token caps and kill switch',
            command: 'npx @cobusgreyling/loop init . --pattern daily-triage --tool claude',
        });
    }
    if (!runLog) {
        actions.push({
            priority: 11,
            text: 'Add loop-run-log.md so runs are observable',
        });
    }
    if (readyScore !== null && readyScore < 40) {
        actions.push({
            priority: 5,
            text: 'Raise Loop Ready above 40 before scheduling unattended work',
            command: `npx @cobusgreyling/loop audit ${target} --suggest`,
        });
    }
    if (syncLevel === 'critical') {
        actions.push({
            priority: 4,
            text: 'Fix STATE ↔ LOOP drift before the next scheduled run',
            command: `npx @cobusgreyling/loop sync ${target}`,
        });
    }
    for (const rec of auditRecs.slice(0, 3)) {
        actions.push({ priority: 50, text: rec });
    }
    if (readyScore !== null && readyScore >= 80) {
        actions.push({
            priority: 90,
            text: 'Optional next: version the loop as a harness (Foundry)',
            command: 'npx @cobusgreyling/loop init . --with-foundry',
        });
        actions.push({
            priority: 91,
            text: 'Share your score',
            command: `npx @cobusgreyling/loop badge ${target}`,
        });
    }
    // Dedupe by text, keep best priority
    const byText = new Map();
    for (const a of actions) {
        const prev = byText.get(a.text);
        if (!prev || a.priority < prev.priority)
            byText.set(a.text, a);
    }
    const topActions = [...byText.values()].sort((a, b) => a.priority - b.priority).slice(0, 3);
    // Severity / exit code
    let severity = 'healthy';
    let exitCode = 0;
    const blocked = (readyScore !== null && readyScore < 40) ||
        syncLevel === 'critical' ||
        (!stateName && !loopMd);
    const warning = (readyScore !== null && readyScore < 58) ||
        syncLevel === 'warning' ||
        issueCount > 0 ||
        !budgetPresent(budgetRaw) ||
        !runLog;
    if (blocked) {
        severity = 'blocked';
        exitCode = 2;
    }
    else if (warning) {
        severity = 'warning';
        exitCode = 1;
    }
    return {
        target: root,
        severity,
        exitCode,
        ready: {
            score: readyScore,
            level: readyLevel,
            assessment,
        },
        sync: {
            score: syncScore,
            level: syncLevel,
            issueCount,
        },
        files: {
            state: stateName,
            loopMd,
            budget: budgetPresent(budgetRaw),
            runLog,
            constraints,
            gate,
            agentsMd,
        },
        actions: topActions,
        notes,
    };
}
export function formatDoctorHuman(r) {
    const lines = [];
    lines.push('');
    lines.push(`Loop doctor — ${r.target}`);
    lines.push('═'.repeat(50));
    const score = r.ready.score !== null ? `${r.ready.score}/100 ${r.ready.level ?? ''}`.trim() : 'n/a';
    lines.push(`Ready:   ${score}`);
    if (r.ready.assessment)
        lines.push(`         ${r.ready.assessment}`);
    const sync = r.sync.score !== null
        ? `${r.sync.score}/100 (${r.sync.level ?? '?'}) · ${r.sync.issueCount} issue(s)`
        : 'n/a';
    lines.push(`Sync:    ${sync}`);
    lines.push(`Files:   state=${r.files.state ?? 'missing'}  LOOP.md=${yn(r.files.loopMd)}  budget=${yn(r.files.budget)}  run-log=${yn(r.files.runLog)}  gate=${yn(r.files.gate)}`);
    lines.push(`Status:  ${r.severity.toUpperCase()} (exit ${r.exitCode})`);
    lines.push('');
    if (r.actions.length) {
        lines.push('Top next actions:');
        r.actions.forEach((a, i) => {
            lines.push(`  ${i + 1}. ${a.text}`);
            if (a.command)
                lines.push(`     $ ${a.command}`);
        });
    }
    else {
        lines.push('No blockers — schedule a report-only run and append loop-run-log.md.');
    }
    if (r.notes.length) {
        lines.push('');
        lines.push('Notes:');
        for (const n of r.notes)
            lines.push(`  · ${n}`);
    }
    lines.push('');
    lines.push('Week one: report only. Old packages still work: loop-init, loop-audit, …');
    lines.push('Docs: https://github.com/cobusgreyling/loop-engineering/blob/main/docs/QUICKSTART.md');
    lines.push('');
    return lines.join('\n');
}
function yn(b) {
    return b ? 'yes' : 'no';
}
