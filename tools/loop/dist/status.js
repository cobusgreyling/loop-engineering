/**
 * loop status — day-2 dashboard over existing markdown artifacts.
 */
import path from 'node:path';
import { runToolCapture } from './pass-through.js';
import { extractLastRun, extractPatternsFromLoop, fileExists, findStateFile, parseLedger, parseRunLog, readText, } from './files.js';
function parseJsonLoose(stdout) {
    const t = stdout.trim();
    if (!t)
        return null;
    try {
        return JSON.parse(t);
    }
    catch {
        const start = t.indexOf('{');
        if (start < 0)
            return null;
        try {
            return JSON.parse(t.slice(start));
        }
        catch {
            return null;
        }
    }
}
export async function runStatus(target) {
    const root = path.resolve(target);
    const stateName = await findStateFile(root);
    const stateRaw = stateName ? await readText(path.join(root, stateName)) : null;
    const loopRaw = await readText(path.join(root, 'LOOP.md'));
    const runLogRaw = await readText(path.join(root, 'loop-run-log.md'));
    const ledgerRaw = await readText(path.join(root, 'loop-ledger.json'));
    const budgetPresent = await fileExists(path.join(root, 'loop-budget.md'));
    const gatePresent = await fileExists(path.join(root, 'gate.yaml'));
    const constraintsPresent = await fileExists(path.join(root, 'loop-constraints.md'));
    let readyScore = null;
    let readyLevel = null;
    try {
        const auditRun = await runToolCapture('audit', [root, '--json']);
        const j = parseJsonLoose(auditRun.stdout);
        if (j && typeof j.score === 'number') {
            readyScore = j.score;
            readyLevel = j.level ?? null;
        }
    }
    catch {
        /* status still useful without audit */
    }
    const recentRuns = runLogRaw ? parseRunLog(runLogRaw, 5) : [];
    const patterns = extractPatternsFromLoop(loopRaw);
    if (recentRuns[0]?.pattern && !patterns.includes(recentRuns[0].pattern)) {
        patterns.unshift(recentRuns[0].pattern);
    }
    let nextHint = 'Run: npx @cobusgreyling/loop doctor .';
    if (!stateName && !loopRaw) {
        nextHint = 'Scaffold: npx @cobusgreyling/loop init . --pattern daily-triage --tool claude';
    }
    else if (recentRuns.length === 0) {
        nextHint = 'Schedule a report-only first run and append loop-run-log.md';
    }
    else if (readyScore !== null && readyScore >= 80) {
        nextHint = 'Optional: npx @cobusgreyling/loop badge .';
    }
    return {
        target: root,
        patterns,
        stateFile: stateName,
        lastRunFromState: extractLastRun(stateRaw),
        ready: { score: readyScore, level: readyLevel },
        recentRuns,
        ledger: parseLedger(ledgerRaw),
        budget: { present: budgetPresent, path: 'loop-budget.md' },
        gate: { present: gatePresent },
        constraints: { present: constraintsPresent },
        nextHint,
    };
}
export function formatStatusHuman(r) {
    const lines = [];
    lines.push('');
    lines.push(`Loop status · ${r.target}`);
    lines.push('═'.repeat(50));
    lines.push(`  Pattern:  ${r.patterns.length ? r.patterns.join(', ') : '(none detected — check LOOP.md)'}`);
    lines.push(`  Ready:    ${r.ready.score !== null ? `${r.ready.score}/100  ${r.ready.level ?? ''}` : 'n/a'}`.trimEnd());
    lines.push(`  State:    ${r.stateFile ?? 'missing'}${r.lastRunFromState ? ` · ${r.lastRunFromState}` : ''}`);
    lines.push(`  Budget:   ${r.budget.present ? 'loop-budget.md' : 'missing'}  · gate=${r.gate.present ? 'yes' : 'no'}  · constraints=${r.constraints.present ? 'yes' : 'no'}`);
    if (r.ledger.present) {
        lines.push(`  Ledger:   present${r.ledger.pattern ? ` · ${r.ledger.pattern}` : ''}${r.ledger.attempts != null ? ` · ${r.ledger.attempts} attempt(s)` : ''}`);
    }
    lines.push('');
    lines.push('  Recent runs:');
    if (!r.recentRuns.length) {
        lines.push('    (none in loop-run-log.md)');
    }
    else {
        for (const e of r.recentRuns) {
            const bits = [
                e.run_id ?? '?',
                e.pattern ?? '?',
                e.outcome ?? '?',
                e.tokens_estimate != null ? `~${e.tokens_estimate} tok` : null,
            ].filter(Boolean);
            lines.push(`    · ${bits.join(' · ')}`);
        }
    }
    lines.push('');
    lines.push(`  Next: ${r.nextHint}`);
    lines.push('');
    return lines.join('\n');
}
