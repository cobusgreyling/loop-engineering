const LEVEL_BADGE_COLORS = {
    L0: '6e7681',
    L1: 'd29922',
    L2: '58a6ff',
    L3: '3ee8c5',
};
const SHOWCASE_URL = 'https://cobusgreyling.github.io/loop-engineering/';
/** ASCII progress bar for terminal + demo GIFs. */
export function formatScoreBar(score, width = 20) {
    const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}  ${score}/100`;
}
function auditTargetArg(target) {
    return target.includes(' ') ? `"${target}"` : target;
}
/** Markdown badge for README — paste output from `loop-audit . --badge`. */
export function formatBadge(r) {
    const color = LEVEL_BADGE_COLORS[r.level];
    const label = encodeURIComponent(`${r.level} (${r.score}/100)`).replace(/%20/g, '_');
    const badgeUrl = `https://img.shields.io/badge/Loop_Ready-${label}-${color}?style=flat-square`;
    return `[![Loop Ready ${r.level} (${r.score}/100)](${badgeUrl})](${SHOWCASE_URL})`;
}
export function formatHuman(r) {
    const lines = [];
    lines.push('');
    lines.push(`Loop Readiness Audit — ${r.target}`);
    lines.push('═'.repeat(50));
    lines.push(`Score: ${r.score}/100  Level: ${r.level}`);
    lines.push(formatScoreBar(r.score));
    lines.push(r.assessment);
    lines.push('');
    lines.push('Findings:');
    for (const f of r.findings) {
        const icon = f.level === 'ok' ? '✓' : f.level === 'warn' ? '!' : '✗';
        lines.push(`  ${icon} ${f.message}`);
    }
    if (r.recommendations.length) {
        lines.push('');
        lines.push('Recommendations:');
        for (const rec of r.recommendations) {
            lines.push(`  → ${rec}`);
        }
    }
    lines.push('');
    lines.push(`Share: npx @cobusgreyling/loop-audit ${auditTargetArg(r.target)} --badge`);
    lines.push('Docs: docs/loop-design-checklist.md');
    lines.push('Tip: rerun with --suggest for ready-to-paste copy commands from templates/starters.');
    lines.push('');
    return lines.join('\n');
}
export function formatJson(r) {
    return JSON.stringify(r, null, 2);
}
export function formatMarkdown(r) {
    const lines = [];
    lines.push('# Loop Readiness Report');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Target | \`${r.target}\` |`);
    lines.push(`| Score | **${r.score}/100** |`);
    lines.push(`| Level | ${r.level} |`);
    lines.push(`| Assessment | ${r.assessment} |`);
    lines.push('');
    lines.push('## Findings');
    lines.push('');
    for (const f of r.findings) {
        lines.push(`- **${f.level}**: ${f.message}`);
    }
    if (r.recommendations.length) {
        lines.push('');
        lines.push('## Recommendations');
        lines.push('');
        for (const rec of r.recommendations) {
            lines.push(`- ${rec}`);
        }
    }
    return lines.join('\n');
}
