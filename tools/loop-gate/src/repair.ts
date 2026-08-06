/** Deterministic intake planner for issue-first repair loops. */

import { readFile } from 'node:fs/promises';
import { minimatch } from 'minimatch';
import { parse } from 'yaml';

export type RepairTargetType = 'issue' | 'pull-request';
export type ReproductionState = 'confirmed' | 'unknown' | 'failed';
export type CheckState = 'success' | 'failure' | 'pending' | 'absent';
export type FailureClass = 'deterministic' | 'unknown' | 'flake' | 'infrastructure';
export type RepairMode = 'change' | 'diagnose' | 'propose';

export interface RepairContract {
  version: 1;
  labels: {
    pause: string;
    lock: string;
    bug: string;
    attemptsPrefix: string;
    priority: string[];
    sensitive: string[];
  };
  maxAttempts: number;
  sensitivePaths: string[];
}

export interface RepairTargetEvidence {
  type: RepairTargetType;
  number: number;
  title: string;
  updatedAt: string;
  labels: string[];
  changedPaths?: string[];
  linkedPullRequest?: number;
  reproduction?: ReproductionState;
  headSha?: string;
  branchOwned?: boolean;
  reviewActionable?: boolean;
  check?: { status: CheckState; failureClass: FailureClass };
}

export interface RepairEvidence {
  version: 1;
  observedAt: string;
  repository: string;
  pauseIssues: number[];
  targets: RepairTargetEvidence[];
}

export interface RepairIssue {
  code: string;
  kind: 'waiting' | 'human-required';
  message: string;
  target?: string;
}

export interface RepairSelection {
  type: RepairTargetType;
  number: number;
  title: string;
  action: 'repair-issue' | 'diagnose-issue' | 'address-review' | 'repair-check' | 'diagnose-check';
  mode: RepairMode;
  attempts: number;
  headSha?: string;
  reason: string;
}

export interface RepairDecision {
  state: 'selected' | 'idle' | 'paused' | 'locked' | 'human-required';
  repository: string;
  selected?: RepairSelection;
  issues: RepairIssue[];
  summary: string;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function integer(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${path} must be a non-negative integer.`);
  return value as number;
}

function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${path} must be an array of strings.`);
  }
  return value;
}

function timestamp(value: unknown, path: string): string {
  const result = string(value, path);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${path} must be an ISO-8601 timestamp.`);
  return result;
}

function optionalEnum<T extends string>(value: unknown, allowed: T[], path: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new Error(`${path} has an unsupported value.`);
  return value as T;
}

export function parseRepairContract(value: unknown, source = 'repair contract'): RepairContract {
  const root = record(value, source);
  if (root.version !== 1) throw new Error(`${source}.version must be 1.`);
  const labels = record(root.labels, `${source}.labels`);
  const maxAttempts = integer(root.maxAttempts, `${source}.maxAttempts`);
  if (maxAttempts === 0) throw new Error(`${source}.maxAttempts must be greater than zero.`);
  return {
    version: 1,
    labels: {
      pause: string(labels.pause, `${source}.labels.pause`),
      lock: string(labels.lock, `${source}.labels.lock`),
      bug: string(labels.bug, `${source}.labels.bug`),
      attemptsPrefix: string(labels.attemptsPrefix, `${source}.labels.attemptsPrefix`),
      priority: strings(labels.priority, `${source}.labels.priority`),
      sensitive: strings(labels.sensitive, `${source}.labels.sensitive`),
    },
    maxAttempts,
    sensitivePaths: strings(root.sensitivePaths, `${source}.sensitivePaths`),
  };
}

function parseTarget(value: unknown, source: string): RepairTargetEvidence {
  const target = record(value, source);
  const type = optionalEnum(target.type, ['issue', 'pull-request'], `${source}.type`);
  if (!type) throw new Error(`${source}.type is required.`);
  const parsed: RepairTargetEvidence = {
    type,
    number: integer(target.number, `${source}.number`),
    title: string(target.title, `${source}.title`),
    updatedAt: timestamp(target.updatedAt, `${source}.updatedAt`),
    labels: strings(target.labels, `${source}.labels`),
  };
  if (parsed.number === 0) throw new Error(`${source}.number must be greater than zero.`);
  if (target.changedPaths !== undefined) parsed.changedPaths = strings(target.changedPaths, `${source}.changedPaths`);
  if (target.linkedPullRequest !== undefined) {
    parsed.linkedPullRequest = integer(target.linkedPullRequest, `${source}.linkedPullRequest`);
  }
  parsed.reproduction = optionalEnum(
    target.reproduction,
    ['confirmed', 'unknown', 'failed'],
    `${source}.reproduction`,
  );
  if (target.headSha !== undefined) parsed.headSha = string(target.headSha, `${source}.headSha`);
  if (target.branchOwned !== undefined) {
    if (typeof target.branchOwned !== 'boolean') throw new Error(`${source}.branchOwned must be a boolean.`);
    parsed.branchOwned = target.branchOwned;
  }
  if (target.reviewActionable !== undefined) {
    if (typeof target.reviewActionable !== 'boolean') throw new Error(`${source}.reviewActionable must be a boolean.`);
    parsed.reviewActionable = target.reviewActionable;
  }
  if (target.check !== undefined) {
    const check = record(target.check, `${source}.check`);
    const status = optionalEnum(check.status, ['success', 'failure', 'pending', 'absent'], `${source}.check.status`);
    const failureClass = optionalEnum(
      check.failureClass,
      ['deterministic', 'unknown', 'flake', 'infrastructure'],
      `${source}.check.failureClass`,
    );
    if (!status || !failureClass) throw new Error(`${source}.check requires status and failureClass.`);
    parsed.check = { status, failureClass };
  }
  return parsed;
}

export function parseRepairEvidence(value: unknown, source = 'repair evidence'): RepairEvidence {
  const root = record(value, source);
  if (root.version !== 1) throw new Error(`${source}.version must be 1.`);
  if (!Array.isArray(root.pauseIssues) || !root.pauseIssues.every((item) => Number.isInteger(item) && item > 0)) {
    throw new Error(`${source}.pauseIssues must contain positive issue numbers.`);
  }
  if (!Array.isArray(root.targets)) throw new Error(`${source}.targets must be an array.`);
  return {
    version: 1,
    observedAt: timestamp(root.observedAt, `${source}.observedAt`),
    repository: string(root.repository, `${source}.repository`),
    pauseIssues: root.pauseIssues as number[],
    targets: root.targets.map((target, index) => parseTarget(target, `${source}.targets[${index}]`)),
  };
}

function attempts(target: RepairTargetEvidence, contract: RepairContract): number | undefined {
  const values = target.labels
    .filter((label) => label.startsWith(contract.labels.attemptsPrefix))
    .map((label) => Number(label.slice(contract.labels.attemptsPrefix.length)))
    .filter((value) => Number.isInteger(value) && value >= 0);
  return values.length === 1 ? values[0] : values.length === 0 ? 0 : undefined;
}

function targetName(target: RepairTargetEvidence): string {
  return `${target.type === 'issue' ? 'issue' : 'PR'} #${target.number}`;
}

function sensitiveReason(target: RepairTargetEvidence, contract: RepairContract): string | undefined {
  const label = target.labels.find((item) => contract.labels.sensitive.includes(item));
  if (label) return `sensitive label ${label}`;
  const path = target.changedPaths?.find((item) => contract.sensitivePaths.some((glob) => minimatch(item, glob, { dot: true })));
  return path ? `sensitive path ${path}` : undefined;
}

interface Candidate {
  target: RepairTargetEvidence;
  selection: RepairSelection;
  score: number;
}

function priorityScore(target: RepairTargetEvidence, contract: RepairContract): number {
  const index = contract.labels.priority.findIndex((label) => target.labels.includes(label));
  return index < 0 ? 0 : (contract.labels.priority.length - index) * 10;
}

function candidateFor(target: RepairTargetEvidence, attempt: number, contract: RepairContract): Candidate | undefined {
  const mode: RepairMode = target.type === 'pull-request' && !target.branchOwned ? 'propose' : 'change';
  const base = { type: target.type, number: target.number, title: target.title, attempts: attempt, headSha: target.headSha };
  const priority = priorityScore(target, contract);
  if (target.type === 'issue' && target.labels.includes(contract.labels.bug) && !target.linkedPullRequest) {
    if (target.reproduction === 'confirmed') {
      return { target, score: 500 + priority, selection: { ...base, action: 'repair-issue', mode: 'change', reason: 'confirmed bug without a linked PR' } };
    }
    if (target.reproduction !== 'failed') {
      return { target, score: 200 + priority, selection: { ...base, action: 'diagnose-issue', mode: 'diagnose', reason: 'bug report needs local reproduction' } };
    }
  }
  if (target.type === 'pull-request' && target.reviewActionable) {
    return { target, score: 400 + priority, selection: { ...base, action: 'address-review', mode, reason: 'actionable review feedback' } };
  }
  if (target.type === 'pull-request' && target.check?.status === 'failure') {
    if (target.check.failureClass === 'deterministic') {
      return { target, score: 300 + priority, selection: { ...base, action: 'repair-check', mode, reason: 'deterministic required-check failure' } };
    }
    if (target.check.failureClass === 'unknown') {
      return { target, score: 100 + priority, selection: { ...base, action: 'diagnose-check', mode: 'diagnose', reason: 'failed check needs classification' } };
    }
  }
  return undefined;
}

export function evaluateRepair(contract: RepairContract, evidence: RepairEvidence): RepairDecision {
  if (evidence.pauseIssues.length > 0) {
    return {
      state: 'paused', repository: evidence.repository, issues: [],
      summary: `Kill switch active on issue(s): ${evidence.pauseIssues.map((number) => `#${number}`).join(', ')}.`,
    };
  }
  const locks = evidence.targets.filter((target) => target.labels.includes(contract.labels.lock));
  if (locks.length > 0) {
    return {
      state: 'locked', repository: evidence.repository, issues: [],
      summary: `Repair already owned by ${locks.map(targetName).join(', ')}.`,
    };
  }

  const issues: RepairIssue[] = [];
  const candidates: Candidate[] = [];
  for (const target of evidence.targets) {
    const name = targetName(target);
    if (target.type === 'issue' && target.linkedPullRequest) {
      issues.push({ code: 'linked-pr', kind: 'waiting', target: name, message: `${name} already has linked PR #${target.linkedPullRequest}.` });
      continue;
    }
    if (target.type === 'issue' && target.reproduction === 'failed') {
      issues.push({ code: 'reproduction-failed', kind: 'human-required', target: name, message: `${name} could not be reproduced.` });
      continue;
    }
    if (target.check?.status === 'failure' && ['flake', 'infrastructure'].includes(target.check.failureClass)) {
      issues.push({ code: 'non-code-failure', kind: 'human-required', target: name, message: `${name} failed because of ${target.check.failureClass}.` });
      continue;
    }
    if (!candidateFor(target, 0, contract)) continue;

    const attempt = attempts(target, contract);
    if (attempt === undefined) {
      issues.push({ code: 'attempt-label-conflict', kind: 'human-required', target: name, message: `${name} has multiple attempt labels.` });
      continue;
    }
    if (attempt >= contract.maxAttempts) {
      issues.push({ code: 'attempt-limit', kind: 'human-required', target: name, message: `${name} reached ${attempt}/${contract.maxAttempts} attempts.` });
      continue;
    }
    const sensitive = sensitiveReason(target, contract);
    if (sensitive) {
      issues.push({ code: 'sensitive-target', kind: 'human-required', target: name, message: `${name} matches ${sensitive}.` });
      continue;
    }
    const candidate = candidateFor(target, attempt, contract);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((left, right) => right.score - left.score || Date.parse(left.target.updatedAt) - Date.parse(right.target.updatedAt));
  const selected = candidates[0]?.selection;
  if (selected) {
    return { state: 'selected', repository: evidence.repository, selected, issues, summary: `Selected ${targetName(candidates[0].target)}: ${selected.reason}.` };
  }
  const human = issues.some((issue) => issue.kind === 'human-required');
  return {
    state: human ? 'human-required' : 'idle', repository: evidence.repository, issues,
    summary: human ? 'No safe repair target; human action is required.' : 'No actionable repair target.',
  };
}

export async function loadRepairContract(path: string): Promise<RepairContract> {
  return parseRepairContract(parse(await readFile(path, 'utf8')), path);
}

export async function loadRepairEvidence(path: string): Promise<RepairEvidence> {
  return parseRepairEvidence(JSON.parse(await readFile(path, 'utf8')), path);
}
