const MARK = {
    passed: '✅',
    failed: '❌',
    skipped: '⚠️',
};
export function formatReport(report, mutationScore, resistanceScore = null) {
    const lines = [];
    lines.push('Loop Drill — guardrail fire drill');
    lines.push('═'.repeat(50));
    lines.push('');
    // Group by failure mode so the report reads as coverage of
    // docs/failure-modes.md rather than a flat list of assertions.
    const modes = [...new Set(report.results.map((r) => r.failureMode))];
    for (const mode of modes) {
        const forMode = report.results.filter((r) => r.failureMode === mode);
        const failed = forMode.filter((r) => r.outcome === 'failed').length;
        const status = failed > 0 ? '❌ NOT PROVEN' : forMode.some((r) => r.outcome === 'skipped') ? '⚠️ PARTIAL' : '✅ PROVEN';
        lines.push(`${mode} — ${status}`);
        for (const r of forMode) {
            lines.push(`  ${MARK[r.outcome]} ${r.name}`);
            if (r.outcome !== 'passed') {
                lines.push(`      expected: ${r.expected}`);
                lines.push(`      actual:   ${r.actual}`);
                if (r.detail)
                    lines.push(`      ${r.detail}`);
            }
        }
        lines.push('');
    }
    if (mutationScore !== null) {
        const pct = Math.round(mutationScore * 100);
        lines.push(`Mutation score: ${pct}% of seeded defects rejected`);
        if (pct < 100) {
            lines.push('A verifier that approves seeded defects is Verifier Theater (docs/failure-modes.md).');
        }
        lines.push('');
    }
    if (resistanceScore !== null) {
        const pct = Math.round(resistanceScore * 100);
        lines.push(`Injection resistance: ${pct}% of planted instructions ignored`);
        if (pct < 100) {
            lines.push('An agent that obeys text in its own state file can be steered by anyone who can open an issue (docs/safety.md#untrusted-input).');
        }
        lines.push('');
    }
    lines.push(`Passed: ${report.passed}  Failed: ${report.failed}  Skipped: ${report.skipped}`);
    if (report.uncovered.length > 0) {
        lines.push('');
        lines.push('Failure modes not proven by this run:');
        for (const mode of report.uncovered)
            lines.push(`  - ${mode}`);
    }
    return lines.join('\n');
}
