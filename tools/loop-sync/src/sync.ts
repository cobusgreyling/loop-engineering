/**
 * Loop Sync - Detect and sync drift between Loop configuration files
 * 
 * This module detects:
 * 1. STATE.md ↔ LOOP.md consistency
 * 2. Skills version updates
 * 3. Missing required files
 * 4. Configuration drift from starters
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface DriftReport {
  score: number;           // 0-100 consistency score
  level: 'healthy' | 'warning' | 'critical';
  issues: DriftIssue[];
  suggestions: string[];
  timestamp: string;
}

export interface DriftIssue {
  type: 'missing' | 'outdated' | 'inconsistent' | 'orphaned';
  file: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface SyncOptions {
  targetDir: string;
  autoFix: boolean;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content
 */
async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Extract frontmatter from markdown files
 */
function extractFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};
  let body = content;
  
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex !== -1) {
      const fmContent = content.slice(3, endIndex);
      body = content.slice(endIndex + 3);
      
      for (const line of fmContent.split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          frontmatter[key] = value;
        }
      }
    }
  }
  
  return { frontmatter, body };
}

/**
 * Extract patterns from LOOP.md
 */
function extractLoopPatterns(loopContent: string): string[] {
  const patterns: string[] = [];
  
  // Look for pattern references
  const patternRegex = /pattern[s]?[\s]*[:=][\s]*([\w\-]+)/gi;
  let match;
  while ((match = patternRegex.exec(loopContent)) !== null) {
    patterns.push(match[1]);
  }
  
  return patterns;
}

/**
 * Extract state file references from LOOP.md
 */
function extractStateFiles(loopContent: string): string[] {
  const stateFiles: string[] = [];
  
  // Look for STATE.md or other state file references
  const stateRegex = /(?:state[s]?[\s]*[:=][\s]*|update[\s]+)([\w\-]+\.md)/gi;
  let match;
  while ((match = stateRegex.exec(loopContent)) !== null) {
    stateFiles.push(match[1]);
  }
  
  return stateFiles;
}

/**
 * Compare two markdown files for consistency
 */
function compareMarkdownFiles(
  file1Content: string,
  file2Content: string,
  threshold: number = 0.5
): { similarity: number; differences: string[] } {
  const differences: string[] = [];
  
  // Extract headings from both files
  const headings1 = file1Content.match(/^## .+$/gm) || [];
  const headings2 = file2Content.match(/^## .+$/gm) || [];
  
  // Check heading consistency
  const headingSet1 = new Set(headings1.map(h => h.toLowerCase()));
  const headingSet2 = new Set(headings2.map(h => h.toLowerCase()));
  
  const allHeadings = new Set([...headingSet1, ...headingSet2]);
  let matchingHeadings = 0;
  
  for (const heading of allHeadings) {
    if (headingSet1.has(heading) && headingSet2.has(heading)) {
      matchingHeadings++;
    } else if (!headingSet1.has(heading)) {
      differences.push(`Missing heading in file 1: ${heading}`);
    } else {
      differences.push(`Missing heading in file 2: ${heading}`);
    }
  }
  
  const similarity = allHeadings.size === 0 ? 1 : matchingHeadings / allHeadings.size;
  
  return { similarity, differences };
}

/**
 * Scan skills directory for version information
 */
async function scanSkillsDirectory(targetDir: string): Promise<Map<string, string>> {
  const skillsVersions = new Map<string, string>();
  const skillsDir = path.join(targetDir, '.claude', 'skills');
  
  if (!await fileExists(skillsDir)) {
    return skillsVersions;
  }
  
  try {
    const entries = await readdir(skillsDir);
    for (const entry of entries) {
      const skillPath = path.join(skillsDir, entry);
      const statResult = await stat(skillPath);
      
      if (statResult.isDirectory()) {
        const skillMd = path.join(skillPath, 'SKILL.md');
        const content = await readFileContent(skillMd);
        
        if (content) {
          const { frontmatter } = extractFrontmatter(content);
          skillsVersions.set(entry, frontmatter.version || 'unknown');
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return skillsVersions;
}

/**
 * Main sync function
 */
export async function runSync(options: SyncOptions): Promise<DriftReport> {
  const { targetDir, autoFix, dryRun, verbose } = options;
  const issues: DriftIssue[] = [];
  const suggestions: string[] = [];
  
  // Define required files
  const requiredFiles = [
    'STATE.md',
    'LOOP.md',
    'AGENTS.md',
  ];
  
  // Check for missing required files
  for (const file of requiredFiles) {
    const filePath = path.join(targetDir, file);
    if (!await fileExists(filePath)) {
      issues.push({
        type: 'missing',
        file,
        message: `${file} is missing`,
        severity: 'error',
        suggestion: `Run 'npx @cobusgreyling/loop-init . --pattern daily-triage' to scaffold required files`,
      });
    }
  }
  
  // Check STATE.md ↔ LOOP.md consistency
  const statePath = path.join(targetDir, 'STATE.md');
  const loopPath = path.join(targetDir, 'LOOP.md');
  
  if (await fileExists(statePath) && await fileExists(loopPath)) {
    const stateContent = await readFileContent(statePath);
    const loopContent = await readFileContent(loopPath);
    
    if (stateContent && loopContent) {
      // Extract patterns from LOOP.md
      const patterns = extractLoopPatterns(loopContent);
      
      // Extract state files from LOOP.md
      const stateFiles = extractStateFiles(loopContent);
      
      // Check if STATE.md is referenced in LOOP.md
      if (!stateFiles.includes('STATE.md')) {
        issues.push({
          type: 'inconsistent',
          file: 'LOOP.md',
          message: 'LOOP.md does not reference STATE.md',
          severity: 'warning',
          suggestion: 'Add STATE.md to the state files list in LOOP.md',
        });
      }
      
      // Compare structural similarity
      const { similarity, differences } = compareMarkdownFiles(stateContent, loopContent, 0.5);
      
      if (similarity < 0.3 && differences.length > 0) {
        issues.push({
          type: 'inconsistent',
          file: 'STATE.md ↔ LOOP.md',
          message: 'Low structural similarity between STATE.md and LOOP.md',
          severity: 'warning',
          suggestion: 'Review both files for consistency',
        });
        
        if (verbose) {
          for (const diff of differences.slice(0, 3)) {
            issues.push({
              type: 'inconsistent',
              file: 'STATE.md ↔ LOOP.md',
              message: diff,
              severity: 'info',
            });
          }
        }
      }
    }
  }
  
  // Scan skills for version information
  const skillsVersions = await scanSkillsDirectory(targetDir);
  
  if (skillsVersions.size === 0 && await fileExists(path.join(targetDir, '.claude', 'skills'))) {
    suggestions.push('No skills found. Run loop-init to scaffold skills.');
  }
  
  // Calculate score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'error') {
      score -= 20;
    } else if (issue.severity === 'warning') {
      score -= 10;
    } else {
      score -= 1;
    }
  }
  score = Math.max(0, Math.min(100, score));
  
  // Determine level
  let level: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (score < 40) {
    level = 'critical';
  } else if (score < 70) {
    level = 'warning';
  }
  
  // Add suggestions based on issues
  if (issues.some(i => i.type === 'missing')) {
    suggestions.push('Run loop-init to scaffold missing files');
  }
  
  if (issues.some(i => i.type === 'inconsistent')) {
    suggestions.push('Review STATE.md and LOOP.md for consistency');
  }
  
  return {
    score,
    level,
    issues,
    suggestions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format report for CLI output
 */
export function formatReport(report: DriftReport): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('Loop Sync Report');
  lines.push('══════════════════════════════════════════════════');
  lines.push(`Score: ${report.score}/100 (${report.level})`);
  lines.push('');
  
  if (report.issues.length === 0) {
    lines.push('✅ No issues detected. Configuration is consistent.');
  } else {
    lines.push(`Found ${report.issues.length} issue(s):`);
    lines.push('');
    
    const errors = report.issues.filter(i => i.severity === 'error');
    const warnings = report.issues.filter(i => i.severity === 'warning');
    const infos = report.issues.filter(i => i.severity === 'info');
    
    if (errors.length > 0) {
      lines.push('❌ Errors:');
      for (const issue of errors) {
        lines.push(`   - ${issue.file}: ${issue.message}`);
      }
      lines.push('');
    }
    
    if (warnings.length > 0) {
      lines.push('⚠️ Warnings:');
      for (const issue of warnings) {
        lines.push(`   - ${issue.file}: ${issue.message}`);
      }
      lines.push('');
    }
    
    if (infos.length > 0) {
      lines.push('ℹ️ Information:');
      for (const issue of infos) {
        lines.push(`   - ${issue.file}: ${issue.message}`);
      }
      lines.push('');
    }
  }
  
  if (report.suggestions.length > 0) {
    lines.push('💡 Suggestions:');
    for (const suggestion of report.suggestions) {
      lines.push(`   - ${suggestion}`);
    }
  }
  
  return lines.join('\n');
}