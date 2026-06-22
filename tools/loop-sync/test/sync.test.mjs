import { describe, it, expect } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { runSync, formatReport } from '../src/sync.js';

// Create a temporary test directory
const testDir = path.join(process.cwd(), '.test-tmp');

async function setupTestDir() {
  await mkdir(testDir, { recursive: true });
  
  // Create STATE.md
  await writeFile(
    path.join(testDir, 'STATE.md'),
    `# Loop State

Last run: 2026-06-22

## High Priority
- No items

## Watch List
- No items
`
  );
  
  // Create LOOP.md
  await writeFile(
    path.join(testDir, 'LOOP.md'),
    `# Loop Configuration

## Patterns
- daily-triage

## State Files
- STATE.md

## Schedule
- Cadence: 1d
- Level: L1
`
  );
}

async function cleanupTestDir() {
  await rm(testDir, { recursive: true, force: true });
}

describe('runSync', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  it('should return a valid DriftReport', async () => {
    const report = await runSync({ targetDir: testDir });
    
    assert.ok(typeof report.score === 'number');
    assert.ok(['healthy', 'warning', 'critical'].includes(report.level));
    assert.ok(Array.isArray(report.issues));
    assert.ok(Array.isArray(report.suggestions));
    assert.ok(report.timestamp);
  });

  it('should detect missing files', async () => {
    // Remove AGENTS.md (it's not created by setup)
    const report = await runSync({ targetDir: testDir });
    
    // Should have at least one issue about missing AGENTS.md
    const agentsIssue = report.issues.find(i => i.file === 'AGENTS.md');
    assert.ok(agentsIssue);
    assert.ok(agentsIssue.message.includes('missing'));
  });

  it('should calculate score correctly', async () => {
    const report = await runSync({ targetDir: testDir });
    
    // With STATE.md and LOOP.md present, score should be reasonable
    assert.ok(report.score >= 0);
    assert.ok(report.score <= 100);
  });

  it('should provide suggestions', async () => {
    const report = await runSync({ targetDir: testDir });
    
    // Should have at least one suggestion
    assert.ok(report.suggestions.length > 0);
  });
});

describe('formatReport', () => {
  it('should format report as string', () => {
    const report = {
      score: 85,
      level: 'healthy',
      issues: [],
      suggestions: ['Run loop-init'],
      timestamp: new Date().toISOString(),
    };
    
    const formatted = formatReport(report);
    
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.includes('Loop Sync Report'));
    assert.ok(formatted.includes('85/100'));
  });

  it('should show issues when present', () => {
    const report = {
      score: 60,
      level: 'warning',
      issues: [
        {
          type: 'missing',
          file: 'AGENTS.md',
          message: 'AGENTS.md is missing',
          severity: 'error',
        },
      ],
      suggestions: [],
      timestamp: new Date().toISOString(),
    };
    
    const formatted = formatReport(report);
    
    assert.ok(formatted.includes('AGENTS.md'));
    assert.ok(formatted.includes('missing'));
  });
});