import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileExists, scanSkillDirectories } from '@cobusgreyling/readiness-core';
const GOAL_FILES = ['GOAL.md', 'goal.md', 'docs/GOAL.md'];
const GOAL_SKILL_NAMES = [
    'goal-verifier',
    'goal-scoper',
    'goal-completion-check',
];
const SAFETY_FILES = ['docs/safety.md', 'SECURITY.md', 'safety.md'];
const BUDGET_FILES = ['goal-budget.md', 'docs/goal-budget.md'];
const RUN_LOG_FILES = ['goal-run-log.md', 'docs/goal-run-log.md'];
async function findSkills(root) {
    return scanSkillDirectories(root);
}
async function detectTests(root) {
    const hints = [
        'package.json',
        'pyproject.toml',
        'go.mod',
        'Cargo.toml',
        'vitest.config.ts',
        'jest.config.js',
        'pytest.ini',
    ];
    for (const h of hints) {
        if (await fileExists(path.join(root, h)))
            return true;
    }
    const testDirs = ['tests', 'test', '__tests__'];
    for (const d of testDirs) {
        if (await fileExists(path.join(root, d)))
            return true;
    }
    return false;
}
async function detectCi(root) {
    const ciPaths = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'Jenkinsfile',
    ];
    for (const p of ciPaths) {
        if (await fileExists(path.join(root, p)))
            return true;
    }
    return false;
}
function scoreLevel(score) {
    if (score >= 80)
        return 'G3';
    if (score >= 60)
        return 'G2';
    if (score >= 40)
        return 'G1';
    return 'G0';
}
function assessmentFor(level) {
    switch (level) {
        case 'G3':
            return 'production-ready goal workflows';
        case 'G2':
            return 'verified goals with checker split';
        case 'G1':
            return 'assisted goals — add verifier for G2';
        default:
            return 'ad hoc — scaffold GOAL.md and skills';
    }
}
export async function auditProject(target) {
    const root = path.resolve(target);
    const findings = [];
    const recommendations = [];
    let score = 0;
    const goalPaths = [];
    for (const f of GOAL_FILES) {
        if (await fileExists(path.join(root, f)))
            goalPaths.push(f);
    }
    const goalFilePresent = goalPaths.length > 0;
    if (goalFilePresent) {
        score += 15;
        findings.push({ level: 'ok', message: `GOAL file present (${goalPaths.join(', ')})` });
    }
    else {
        findings.push({ level: 'fail', message: 'No GOAL.md — goals will not survive compaction' });
        recommendations.push('cp templates/GOAL.md.template GOAL.md');
    }
    // GOAL_FILES is this tool's statement of where a goal file may live, so where it lives
    // must not change the score: `goal.md` or `docs/GOAL.md` used to score 5 less than the
    // same file at the root, and `signals.goalConfig.present` contradicted
    // `signals.goalFile.present`. Both fields read the same answer now.
    const goalConfigPresent = goalFilePresent;
    if (goalConfigPresent)
        score += 5;
    const allSkills = await findSkills(root);
    const goalSkills = allSkills.filter((s) => GOAL_SKILL_NAMES.includes(s));
    if (goalSkills.length > 0) {
        score += 10 + Math.min(goalSkills.length * 5, 15);
        findings.push({ level: 'ok', message: `Goal skills: ${goalSkills.join(', ')}` });
    }
    else {
        findings.push({ level: 'warn', message: 'No goal-verifier / goal-scoper skills found' });
        recommendations.push('cp -r starters/minimal-goal/.grok/skills/goal-verifier .grok/skills/');
    }
    const verifierPresent = goalSkills.includes('goal-verifier') || allSkills.some((s) => s.includes('verifier'));
    if (verifierPresent) {
        score += 20;
        findings.push({ level: 'ok', message: 'Verifier skill or agent present' });
    }
    else {
        findings.push({ level: 'fail', message: 'No verifier — implementer may self-grade' });
        recommendations.push('Add goal-verifier skill from skills/goal-verifier/');
    }
    const scoperPresent = goalSkills.includes('goal-scoper');
    if (scoperPresent)
        score += 5;
    const agentsPath = path.join(root, 'AGENTS.md');
    const agentsPresent = await fileExists(agentsPath);
    let mentionsGoal = false;
    if (agentsPresent) {
        const content = await readFile(agentsPath, 'utf8');
        mentionsGoal = /goal|update_goal|GOAL\.md/i.test(content);
        score += mentionsGoal ? 10 : 5;
        findings.push({
            level: mentionsGoal ? 'ok' : 'warn',
            message: mentionsGoal ? 'AGENTS.md mentions goal discipline' : 'AGENTS.md present but no goal rules',
        });
        if (!mentionsGoal) {
            recommendations.push('Add goal rules to AGENTS.md: verifier before completed: true');
        }
    }
    else {
        findings.push({ level: 'warn', message: 'No AGENTS.md' });
        recommendations.push('gbs scaffold agents-md --write (from grok-build-showcase) or write AGENTS.md');
    }
    const patternsPresent = (await fileExists(path.join(root, 'patterns'))) ||
        (await fileExists(path.join(root, 'docs', 'api-reference.md')));
    if (patternsPresent) {
        score += 5;
        findings.push({ level: 'ok', message: 'Goal patterns or API docs present' });
    }
    let safetyDocPresent = false;
    for (const f of SAFETY_FILES) {
        if (await fileExists(path.join(root, f))) {
            safetyDocPresent = true;
            break;
        }
    }
    let budgetDoc = false;
    for (const f of BUDGET_FILES) {
        if (await fileExists(path.join(root, f))) {
            budgetDoc = true;
            break;
        }
    }
    if (safetyDocPresent)
        score += 5;
    if (budgetDoc) {
        score += 10;
        findings.push({ level: 'ok', message: 'Goal budget documented' });
    }
    else {
        recommendations.push('cp templates/goal-budget.md.template goal-budget.md');
    }
    const testsPresent = await detectTests(root);
    if (testsPresent) {
        score += 15;
        findings.push({ level: 'ok', message: 'Test harness detected' });
    }
    else {
        findings.push({ level: 'warn', message: 'No test harness — done conditions are subjective' });
    }
    const ciPresent = await detectCi(root);
    if (ciPresent) {
        score += 10;
        findings.push({ level: 'ok', message: 'CI configuration present' });
    }
    let runLog = false;
    for (const f of RUN_LOG_FILES) {
        if (await fileExists(path.join(root, f))) {
            runLog = true;
            break;
        }
    }
    if (runLog) {
        score += 5;
        findings.push({ level: 'ok', message: 'Goal run log present' });
    }
    score = Math.min(100, score);
    const level = scoreLevel(score);
    if (level === 'G0') {
        recommendations.push('Read docs/goal-design-checklist.md and starters/minimal-goal/');
    }
    if (level === 'G1' && !verifierPresent) {
        recommendations.push('Graduate to G2: add goal-verifier before unattended goals');
    }
    return {
        target: root,
        score,
        level,
        assessment: assessmentFor(level),
        signals: {
            goalFile: { present: goalFilePresent, path: goalPaths[0] },
            goalConfig: { present: goalConfigPresent },
            skills: { count: allSkills.length, goalSkills },
            verifier: { present: verifierPresent },
            scoper: { present: scoperPresent },
            agentsMd: { present: agentsPresent, mentionsGoal },
            patterns: { documented: patternsPresent },
            safety: { safetyDocPresent, budgetDoc },
            tests: { present: testsPresent },
            ci: { present: ciPresent },
            runLog: { present: runLog },
        },
        findings,
        recommendations: [...new Set(recommendations)],
    };
}
//# sourceMappingURL=auditor.js.map