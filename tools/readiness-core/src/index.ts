import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface Finding {
  level: 'ok' | 'warn' | 'fail';
  message: string;
}

export interface BaseAuditResult<TLevel extends string, TSignals> {
  target: string;
  score: number;
  level: TLevel;
  assessment: string;
  signals: TSignals;
  findings: Finding[];
  recommendations: string[];
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans standard skill directories (.grok, .claude, .codex, skills)
 * and returns a list of discovered skill directories/names.
 */
export async function scanSkillDirectories(root: string): Promise<string[]> {
  const dirs = [
    path.join(root, '.grok', 'skills'),
    path.join(root, '.claude', 'skills'),
    path.join(root, '.codex', 'skills'),
    path.join(root, 'skills'),
  ];
  const foundSet = new Set<string>();
  for (const dir of dirs) {
    if (!(await fileExists(dir))) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) foundSet.add(e.name);
      if (e.isFile() && e.name === 'SKILL.md') foundSet.add('root-skill');
    }
  }
  return [...foundSet];
}
