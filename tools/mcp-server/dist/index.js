#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveProjectRoot, loadRegistry, loadPatternDoc, listSkills, loadSkill, loadState, listStateFiles, loadLoopConfig, loadBudget, loadRunLog, loadSafetyDoc, listPatternDocs, } from './resolver.js';
const server = new McpServer({
    name: 'loop-engineering',
    version: '1.0.0',
});
// ── Resources ──────────────────────────────────────────────────────
server.resource('registry', 'loop://registry', { description: 'Machine-readable pattern registry (all 7 patterns with metadata, costs, phases)' }, async () => {
    const root = await resolveProjectRoot();
    const registry = await loadRegistry(root);
    return {
        contents: [{
                uri: 'loop://registry',
                mimeType: 'application/json',
                text: registry ? JSON.stringify(registry, null, 2) : '{"error": "registry.yaml not found"}',
            }],
    };
});
server.resource('loop-config', 'loop://config', { description: 'LOOP.md — cadence, budget, gates, and scheduling configuration' }, async () => {
    const root = await resolveProjectRoot();
    const content = await loadLoopConfig(root);
    return {
        contents: [{
                uri: 'loop://config',
                mimeType: 'text/markdown',
                text: content ?? 'LOOP.md not found',
            }],
    };
});
server.resource('budget', 'loop://budget', { description: 'loop-budget.md — token caps, kill switch policy, spending limits' }, async () => {
    const root = await resolveProjectRoot();
    const content = await loadBudget(root);
    return {
        contents: [{
                uri: 'loop://budget',
                mimeType: 'text/markdown',
                text: content ?? 'loop-budget.md not found',
            }],
    };
});
server.resource('run-log', 'loop://run-log', { description: 'loop-run-log.md — append-only run history with timestamps and outcomes' }, async () => {
    const root = await resolveProjectRoot();
    const content = await loadRunLog(root);
    return {
        contents: [{
                uri: 'loop://run-log',
                mimeType: 'text/markdown',
                text: content ?? 'loop-run-log.md not found',
            }],
    };
});
server.resource('safety', 'loop://safety', { description: 'Safety documentation — denylists, auto-merge policy, MCP scopes, human gates' }, async () => {
    const root = await resolveProjectRoot();
    const content = await loadSafetyDoc(root);
    return {
        contents: [{
                uri: 'loop://safety',
                mimeType: 'text/markdown',
                text: content ?? 'No safety documentation found',
            }],
    };
});
// ── Resource Templates (dynamic) ───────────────────────────────────
server.resource('pattern', new ResourceTemplate('loop://patterns/{patternId}', { list: undefined }), { description: 'Full pattern documentation by ID (e.g. daily-triage, pr-babysitter, ci-sweeper)' }, async (uri, variables) => {
    const patternId = variables.patternId;
    const root = await resolveProjectRoot();
    const content = await loadPatternDoc(root, patternId);
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'text/markdown',
                text: content ?? `Pattern "${patternId}" not found. Use loop_list_patterns to see available patterns.`,
            }],
    };
});
server.resource('skill', new ResourceTemplate('loop://skills/{skillName}', { list: undefined }), { description: 'Skill definition (SKILL.md) by name (e.g. loop-triage, minimal-fix, loop-verifier)' }, async (uri, variables) => {
    const skillName = variables.skillName;
    const root = await resolveProjectRoot();
    const skill = await loadSkill(root, skillName);
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'text/markdown',
                text: skill?.content ?? `Skill "${skillName}" not found. Use loop_list_skills to see available skills.`,
            }],
    };
});
server.resource('state', new ResourceTemplate('loop://state/{stateFile}', { list: undefined }), { description: 'State file content (e.g. STATE.md, pr-babysitter-state.md)' }, async (uri, variables) => {
    const stateFile = variables.stateFile;
    const root = await resolveProjectRoot();
    const content = await loadState(root, stateFile);
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'text/markdown',
                text: content ?? `State file "${stateFile}" not found. Use loop_list_state_files to see available state files.`,
            }],
    };
});
// ── Tools ──────────────────────────────────────────────────────────
server.tool('loop_list_patterns', 'List all available loop engineering patterns with their goals, cadences, and risk levels', {}, async () => {
    const root = await resolveProjectRoot();
    const registry = await loadRegistry(root);
    if (!registry) {
        return { content: [{ type: 'text', text: 'No registry.yaml found in patterns/' }] };
    }
    const summary = registry.patterns.map(p => ({
        id: p.id,
        name: p.name,
        goal: p.goal,
        cadence: p.cadence,
        risk: p.risk,
        week_one_mode: p.week_one_mode,
        token_cost: p.token_cost,
        state: p.state,
    }));
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
});
server.tool('loop_list_skills', 'List all available skills with their names and locations', {}, async () => {
    const root = await resolveProjectRoot();
    const skills = await listSkills(root);
    if (skills.length === 0) {
        return { content: [{ type: 'text', text: 'No skills found. Install from starters/ or skills/' }] };
    }
    const summary = skills.map(s => ({ name: s.name, path: s.path }));
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
});
server.tool('loop_list_state_files', 'List all state files present in the project', {}, async () => {
    const root = await resolveProjectRoot();
    const files = await listStateFiles(root);
    return {
        content: [{
                type: 'text',
                text: files.length > 0
                    ? JSON.stringify(files, null, 2)
                    : 'No state files found. Create STATE.md from templates/STATE.md.template',
            }],
    };
});
server.tool('loop_get_pattern', 'Get full documentation for a specific pattern by ID', { patternId: z.string().describe('Pattern ID (e.g. daily-triage, pr-babysitter, ci-sweeper)') }, async ({ patternId }) => {
    const root = await resolveProjectRoot();
    const registry = await loadRegistry(root);
    const meta = registry?.patterns.find(p => p.id === patternId);
    const doc = await loadPatternDoc(root, patternId);
    if (!meta && !doc) {
        const available = await listPatternDocs(root);
        return {
            content: [{
                    type: 'text',
                    text: `Pattern "${patternId}" not found. Available: ${available.join(', ')}`,
                }],
        };
    }
    const parts = [];
    if (meta) {
        parts.push('## Registry Metadata\n```json\n' + JSON.stringify(meta, null, 2) + '\n```\n');
    }
    if (doc) {
        parts.push('## Pattern Documentation\n\n' + doc);
    }
    return { content: [{ type: 'text', text: parts.join('\n') }] };
});
server.tool('loop_get_skill', 'Get the full SKILL.md definition for a named skill', { skillName: z.string().describe('Skill name (e.g. loop-triage, minimal-fix, loop-verifier)') }, async ({ skillName }) => {
    const root = await resolveProjectRoot();
    const skill = await loadSkill(root, skillName);
    if (!skill) {
        const all = await listSkills(root);
        return {
            content: [{
                    type: 'text',
                    text: `Skill "${skillName}" not found. Available: ${all.map(s => s.name).join(', ')}`,
                }],
        };
    }
    return { content: [{ type: 'text', text: skill.content }] };
});
server.tool('loop_get_state', 'Read a state file to understand current loop status', { stateFile: z.string().optional().describe('State file name (default: STATE.md)') }, async ({ stateFile }) => {
    const root = await resolveProjectRoot();
    const content = await loadState(root, stateFile);
    if (!content) {
        const available = await listStateFiles(root);
        return {
            content: [{
                    type: 'text',
                    text: `State file "${stateFile ?? 'STATE.md'}" not found. Available: ${available.join(', ') || 'none'}`,
                }],
        };
    }
    return { content: [{ type: 'text', text: content }] };
});
server.tool('loop_recommend_pattern', 'Recommend the best loop pattern for a given use case', {
    useCase: z.string().describe('Describe what you want the loop to do (e.g. "watch CI failures", "review PRs", "update dependencies")'),
}, async ({ useCase }) => {
    const root = await resolveProjectRoot();
    const registry = await loadRegistry(root);
    if (!registry) {
        return { content: [{ type: 'text', text: 'No registry found' }] };
    }
    const lower = useCase.toLowerCase();
    const scored = registry.patterns.map(p => {
        let score = 0;
        const fields = [p.id, p.name, p.goal, ...p.skills, ...p.phases].join(' ').toLowerCase();
        const words = lower.split(/\s+/);
        for (const w of words) {
            if (w.length < 3)
                continue;
            if (fields.includes(w))
                score += 2;
        }
        if (lower.includes('ci') && p.id.includes('ci'))
            score += 5;
        if (lower.includes('pr') && p.id.includes('pr'))
            score += 5;
        if (lower.includes('depend') && p.id.includes('dependency'))
            score += 5;
        if (lower.includes('changelog') && p.id.includes('changelog'))
            score += 5;
        if (lower.includes('issue') && p.id.includes('issue'))
            score += 5;
        if (lower.includes('triage') && p.id.includes('triage'))
            score += 3;
        if (lower.includes('merge') && p.id.includes('merge'))
            score += 5;
        if (lower.includes('review') && p.id.includes('pr'))
            score += 3;
        if (lower.includes('security') && p.id.includes('dependency'))
            score += 2;
        return { pattern: p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    const lines = ['## Recommended Patterns\n'];
    for (const { pattern: p, score } of top) {
        lines.push(`### ${p.name} (${p.id}) — relevance: ${score}`);
        lines.push(`- **Goal:** ${p.goal}`);
        lines.push(`- **Cadence:** ${p.cadence} | **Risk:** ${p.risk}`);
        lines.push(`- **Start with:** ${p.week_one_mode}`);
        lines.push(`- **Skills needed:** ${p.skills.join(', ')}`);
        lines.push(`- **Starter:** ${p.starter}`);
        lines.push('');
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
});
server.tool('loop_estimate_cost', 'Estimate daily token cost for a pattern at a given readiness level', {
    patternId: z.string().describe('Pattern ID from registry'),
    level: z.enum(['L1', 'L2', 'L3']).describe('Readiness level'),
    cadence: z.string().optional().describe('Override cadence (e.g. "15m", "1d"). Uses pattern default if omitted'),
}, async ({ patternId, level, cadence }) => {
    const root = await resolveProjectRoot();
    const registry = await loadRegistry(root);
    if (!registry) {
        return { content: [{ type: 'text', text: 'No registry found' }] };
    }
    const pattern = registry.patterns.find(p => p.id === patternId);
    if (!pattern) {
        return {
            content: [{
                    type: 'text',
                    text: `Pattern "${patternId}" not found. Available: ${registry.patterns.map(p => p.id).join(', ')}`,
                }],
        };
    }
    const effectiveCadence = cadence ?? pattern.cadence;
    const parts = effectiveCadence.split('-').map(p => p.trim());
    let runsPerDay;
    try {
        const intervals = parts.map(p => {
            const m = p.match(/^(\d+)([mhd])$/);
            if (!m)
                throw new Error(`Invalid interval: ${p}`);
            const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 };
            return Number(m[1]) * ms[m[2]];
        });
        runsPerDay = Math.floor(86_400_000 / Math.min(...intervals));
    }
    catch {
        return { content: [{ type: 'text', text: `Invalid cadence: ${effectiveCadence}` }] };
    }
    const { cost } = pattern;
    const mix = level === 'L1'
        ? { noop: 0.7, report: 0.3, action: 0 }
        : level === 'L2'
            ? { noop: 0.6, report: 0.25, action: 0.15 }
            : { noop: 0.4, report: 0.35, action: 0.25 };
    const realisticPerRun = cost.tokens_noop * mix.noop
        + cost.tokens_report * mix.report
        + cost.tokens_action * mix.action;
    const realisticPerDay = Math.round(realisticPerRun * runsPerDay);
    const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);
    const lines = [
        `## Cost Estimate: ${pattern.name}`,
        `- **Cadence:** ${effectiveCadence} (${runsPerDay} runs/day)`,
        `- **Level:** ${level}`,
        `- **Daily cap:** ${fmt(cost.suggested_daily_cap)}`,
        '',
        '| Scenario | Per Run | Per Day |',
        '|----------|---------|---------|',
        `| No-op | ${fmt(cost.tokens_noop)} | ${fmt(cost.tokens_noop * runsPerDay)} |`,
        `| Report | ${fmt(cost.tokens_report)} | ${fmt(cost.tokens_report * runsPerDay)} |`,
        `| Action | ${fmt(cost.tokens_action)} | ${fmt(cost.tokens_action * runsPerDay)} |`,
        `| **Realistic** | **${fmt(Math.round(realisticPerRun))}** | **${fmt(realisticPerDay)}** |`,
    ];
    if (realisticPerDay > cost.suggested_daily_cap) {
        lines.push('', `> Warning: realistic estimate exceeds daily cap of ${fmt(cost.suggested_daily_cap)}`);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
});
// ── Start ──────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error('MCP server failed to start:', err);
    process.exit(1);
});
export { server };
