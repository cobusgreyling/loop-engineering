/**
 * Evidence-aware PR promotion gate.
 *
 * Static path policy answers "may this kind of change be auto-merged?".
 * Promotion evidence answers the equally important "was this exact PR SHA
 * actually reviewed, deployed, seeded, tested, and accepted?".
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { minimatch } from 'minimatch';
import { checkGate, type GateConfig } from './gate.js';

export type EvidenceStatus = 'success' | 'failure' | 'pending';
export type DatasetKind = 'synthetic' | 'sanitized' | 'production';
export type AcceptanceMode = 'never' | 'always' | 'risk-based';

export interface PromotionContract {
  version: 1;
  authorization: {
    labels: string[];
    minApprovals: number;
  };
  pullRequest: {
    baseBranches: string[];
    requireCleanMerge: boolean;
    requireResolvedThreads: boolean;
    sameRepositoryOnly: boolean;
    maxAttempts: number;
  };
  checks: {
    required: string[];
  };
  deployment: {
    required: boolean;
    environment: string;
    maxAgeHours?: number;
  };
  testData: {
    required: boolean;
    allowedKinds: DatasetKind[];
    requireVersion: boolean;
  };
  e2e: {
    requiredSuites: string[];
    pathSuites?: Array<{ paths: string[]; suites: string[] }>;
    requireDatasetMatch: boolean;
    maxAgeHours?: number;
  };
  manualAcceptance: {
    mode: AcceptanceMode;
    riskLevels?: string[];
    maxAgeHours?: number;
  };
}

export interface PromotionEvidence {
  version: 1;
  observedAt: string;
  pullRequest: {
    number: number;
    headSha: string;
    baseBranch: string;
    baseRepository: string;
    headRepository: string;
    draft: boolean;
    mergeState: string;
    labels: string[];
    approvals: number;
    /** Commit SHA reviewed by the counted approvals. */
    approvalSha?: string;
    changesRequested: boolean;
    unresolvedThreads: number;
    attempts: number;
    riskLevel: string;
    changedPaths: string[];
  };
  checks: Array<{
    name: string;
    status: EvidenceStatus;
    sha: string;
    completedAt?: string;
    url?: string;
  }>;
  deployment?: {
    environment: string;
    status: EvidenceStatus;
    sha: string;
    completedAt: string;
    url?: string;
  };
  testData?: {
    kind: DatasetKind;
    version?: string;
    status: EvidenceStatus;
    sha: string;
    completedAt: string;
  };
  e2e: Array<{
    suite: string;
    status: EvidenceStatus;
    sha: string;
    datasetVersion?: string;
    completedAt: string;
    url?: string;
  }>;
  manualAcceptance?: {
    status: EvidenceStatus;
    sha: string;
    completedAt: string;
    actor?: string;
  };
}

export type PromotionStage =
  | 'intake'
  | 'policy'
  | 'review'
  | 'checks'
  | 'deployment'
  | 'test-data'
  | 'e2e'
  | 'acceptance'
  | 'merge-ready';

export type PromotionIssueKind = 'blocked' | 'waiting' | 'human-required';

export interface PromotionIssue {
  code: string;
  stage: Exclude<PromotionStage, 'merge-ready'>;
  kind: PromotionIssueKind;
  message: string;
}

export interface PromotionDecision {
  allowed: boolean;
  stage: PromotionStage;
  headSha: string;
  pullRequest: number;
  issues: PromotionIssue[];
  summary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`);
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (!isFiniteNonNegative(value)) throw new Error(`${path} must be a non-negative number.`);
  return value;
}

function requireInteger(value: unknown, path: string): number {
  const number = requireNumber(value, path);
  if (!Number.isInteger(number)) throw new Error(`${path} must be an integer.`);
  return number;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!isStringArray(value)) throw new Error(`${path} must be an array of strings.`);
  return value;
}

function requireTimestamp(value: unknown, path: string): string {
  const timestamp = requireString(value, path);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${path} must be an ISO-8601 timestamp.`);
  return timestamp;
}

function requireStatus(value: unknown, path: string): EvidenceStatus {
  if (value !== 'success' && value !== 'failure' && value !== 'pending') {
    throw new Error(`${path} must be one of: success, failure, pending.`);
  }
  return value;
}

function optionalMaxAge(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  const number = requireNumber(value, path);
  if (number === 0) throw new Error(`${path} must be greater than zero.`);
  return number;
}

export function parsePromotionContract(value: unknown, source = 'promotion contract'): PromotionContract {
  const root = requireRecord(value, source);
  if (root.version !== 1) throw new Error(`${source}.version must be 1.`);

  const authorization = requireRecord(root.authorization, `${source}.authorization`);
  const pullRequest = requireRecord(root.pullRequest, `${source}.pullRequest`);
  const checks = requireRecord(root.checks, `${source}.checks`);
  const deployment = requireRecord(root.deployment, `${source}.deployment`);
  const testData = requireRecord(root.testData, `${source}.testData`);
  const e2e = requireRecord(root.e2e, `${source}.e2e`);
  const manualAcceptance = requireRecord(root.manualAcceptance, `${source}.manualAcceptance`);

  const allowedKinds = requireStringArray(testData.allowedKinds, `${source}.testData.allowedKinds`);
  if (!allowedKinds.every((kind) => ['synthetic', 'sanitized', 'production'].includes(kind))) {
    throw new Error(`${source}.testData.allowedKinds contains an unsupported dataset kind.`);
  }
  const mode = requireString(manualAcceptance.mode, `${source}.manualAcceptance.mode`);
  if (!['never', 'always', 'risk-based'].includes(mode)) {
    throw new Error(`${source}.manualAcceptance.mode must be one of: never, always, risk-based.`);
  }

  return {
    version: 1,
    authorization: {
      labels: requireStringArray(authorization.labels, `${source}.authorization.labels`),
      minApprovals: requireInteger(authorization.minApprovals, `${source}.authorization.minApprovals`),
    },
    pullRequest: {
      baseBranches: requireStringArray(pullRequest.baseBranches, `${source}.pullRequest.baseBranches`),
      requireCleanMerge: requireBoolean(pullRequest.requireCleanMerge, `${source}.pullRequest.requireCleanMerge`),
      requireResolvedThreads: requireBoolean(
        pullRequest.requireResolvedThreads,
        `${source}.pullRequest.requireResolvedThreads`,
      ),
      sameRepositoryOnly: requireBoolean(pullRequest.sameRepositoryOnly, `${source}.pullRequest.sameRepositoryOnly`),
      maxAttempts: requireInteger(pullRequest.maxAttempts, `${source}.pullRequest.maxAttempts`),
    },
    checks: { required: requireStringArray(checks.required, `${source}.checks.required`) },
    deployment: {
      required: requireBoolean(deployment.required, `${source}.deployment.required`),
      environment: requireString(deployment.environment, `${source}.deployment.environment`),
      maxAgeHours: optionalMaxAge(deployment.maxAgeHours, `${source}.deployment.maxAgeHours`),
    },
    testData: {
      required: requireBoolean(testData.required, `${source}.testData.required`),
      allowedKinds: allowedKinds as DatasetKind[],
      requireVersion: requireBoolean(testData.requireVersion, `${source}.testData.requireVersion`),
    },
    e2e: {
      requiredSuites: requireStringArray(e2e.requiredSuites, `${source}.e2e.requiredSuites`),
      pathSuites:
        e2e.pathSuites === undefined
          ? undefined
          : (() => {
              if (!Array.isArray(e2e.pathSuites)) throw new Error(`${source}.e2e.pathSuites must be an array.`);
              return e2e.pathSuites.map((item, index) => {
                const rule = requireRecord(item, `${source}.e2e.pathSuites[${index}]`);
                return {
                  paths: requireStringArray(rule.paths, `${source}.e2e.pathSuites[${index}].paths`),
                  suites: requireStringArray(rule.suites, `${source}.e2e.pathSuites[${index}].suites`),
                };
              });
            })(),
      requireDatasetMatch: requireBoolean(e2e.requireDatasetMatch, `${source}.e2e.requireDatasetMatch`),
      maxAgeHours: optionalMaxAge(e2e.maxAgeHours, `${source}.e2e.maxAgeHours`),
    },
    manualAcceptance: {
      mode: mode as AcceptanceMode,
      riskLevels:
        manualAcceptance.riskLevels === undefined
          ? undefined
          : requireStringArray(manualAcceptance.riskLevels, `${source}.manualAcceptance.riskLevels`),
      maxAgeHours: optionalMaxAge(manualAcceptance.maxAgeHours, `${source}.manualAcceptance.maxAgeHours`),
    },
  };
}

function parseEvidenceItems(root: Record<string, unknown>, source: string): PromotionEvidence {
  if (root.version !== 1) throw new Error(`${source}.version must be 1.`);
  const pullRequest = requireRecord(root.pullRequest, `${source}.pullRequest`);
  const checks = Array.isArray(root.checks) ? root.checks : (() => { throw new Error(`${source}.checks must be an array.`); })();
  const e2e = Array.isArray(root.e2e) ? root.e2e : (() => { throw new Error(`${source}.e2e must be an array.`); })();

  const parsed: PromotionEvidence = {
    version: 1,
    observedAt: requireTimestamp(root.observedAt, `${source}.observedAt`),
    pullRequest: {
      number: requireInteger(pullRequest.number, `${source}.pullRequest.number`),
      headSha: requireString(pullRequest.headSha, `${source}.pullRequest.headSha`),
      baseBranch: requireString(pullRequest.baseBranch, `${source}.pullRequest.baseBranch`),
      baseRepository: requireString(pullRequest.baseRepository, `${source}.pullRequest.baseRepository`),
      headRepository: requireString(pullRequest.headRepository, `${source}.pullRequest.headRepository`),
      draft: requireBoolean(pullRequest.draft, `${source}.pullRequest.draft`),
      mergeState: requireString(pullRequest.mergeState, `${source}.pullRequest.mergeState`),
      labels: requireStringArray(pullRequest.labels, `${source}.pullRequest.labels`),
      approvals: requireInteger(pullRequest.approvals, `${source}.pullRequest.approvals`),
      approvalSha:
        pullRequest.approvalSha === undefined
          ? undefined
          : requireString(pullRequest.approvalSha, `${source}.pullRequest.approvalSha`),
      changesRequested: requireBoolean(pullRequest.changesRequested, `${source}.pullRequest.changesRequested`),
      unresolvedThreads: requireInteger(pullRequest.unresolvedThreads, `${source}.pullRequest.unresolvedThreads`),
      attempts: requireInteger(pullRequest.attempts, `${source}.pullRequest.attempts`),
      riskLevel: requireString(pullRequest.riskLevel, `${source}.pullRequest.riskLevel`),
      changedPaths: requireStringArray(pullRequest.changedPaths, `${source}.pullRequest.changedPaths`),
    },
    checks: checks.map((item, index) => {
      const check = requireRecord(item, `${source}.checks[${index}]`);
      return {
        name: requireString(check.name, `${source}.checks[${index}].name`),
        status: requireStatus(check.status, `${source}.checks[${index}].status`),
        sha: requireString(check.sha, `${source}.checks[${index}].sha`),
        completedAt:
          check.completedAt === undefined
            ? undefined
            : requireTimestamp(check.completedAt, `${source}.checks[${index}].completedAt`),
        url: check.url === undefined ? undefined : requireString(check.url, `${source}.checks[${index}].url`),
      };
    }),
    e2e: e2e.map((item, index) => {
      const suite = requireRecord(item, `${source}.e2e[${index}]`);
      return {
        suite: requireString(suite.suite, `${source}.e2e[${index}].suite`),
        status: requireStatus(suite.status, `${source}.e2e[${index}].status`),
        sha: requireString(suite.sha, `${source}.e2e[${index}].sha`),
        datasetVersion:
          suite.datasetVersion === undefined
            ? undefined
            : requireString(suite.datasetVersion, `${source}.e2e[${index}].datasetVersion`),
        completedAt: requireTimestamp(suite.completedAt, `${source}.e2e[${index}].completedAt`),
        url: suite.url === undefined ? undefined : requireString(suite.url, `${source}.e2e[${index}].url`),
      };
    }),
  };

  if (root.deployment !== undefined) {
    const deployment = requireRecord(root.deployment, `${source}.deployment`);
    parsed.deployment = {
      environment: requireString(deployment.environment, `${source}.deployment.environment`),
      status: requireStatus(deployment.status, `${source}.deployment.status`),
      sha: requireString(deployment.sha, `${source}.deployment.sha`),
      completedAt: requireTimestamp(deployment.completedAt, `${source}.deployment.completedAt`),
      url: deployment.url === undefined ? undefined : requireString(deployment.url, `${source}.deployment.url`),
    };
  }

  if (root.testData !== undefined) {
    const testData = requireRecord(root.testData, `${source}.testData`);
    const kind = requireString(testData.kind, `${source}.testData.kind`);
    if (!['synthetic', 'sanitized', 'production'].includes(kind)) {
      throw new Error(`${source}.testData.kind must be one of: synthetic, sanitized, production.`);
    }
    parsed.testData = {
      kind: kind as DatasetKind,
      version:
        testData.version === undefined ? undefined : requireString(testData.version, `${source}.testData.version`),
      status: requireStatus(testData.status, `${source}.testData.status`),
      sha: requireString(testData.sha, `${source}.testData.sha`),
      completedAt: requireTimestamp(testData.completedAt, `${source}.testData.completedAt`),
    };
  }

  if (root.manualAcceptance !== undefined) {
    const acceptance = requireRecord(root.manualAcceptance, `${source}.manualAcceptance`);
    parsed.manualAcceptance = {
      status: requireStatus(acceptance.status, `${source}.manualAcceptance.status`),
      sha: requireString(acceptance.sha, `${source}.manualAcceptance.sha`),
      completedAt: requireTimestamp(acceptance.completedAt, `${source}.manualAcceptance.completedAt`),
      actor:
        acceptance.actor === undefined
          ? undefined
          : requireString(acceptance.actor, `${source}.manualAcceptance.actor`),
    };
  }
  return parsed;
}

export function parsePromotionEvidence(value: unknown, source = 'promotion evidence'): PromotionEvidence {
  return parseEvidenceItems(requireRecord(value, source), source);
}

export async function loadPromotionContract(file: string): Promise<PromotionContract> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    throw new Error(`Promotion contract not found: ${file}.`);
  }
  let value: unknown;
  try {
    value = parse(raw);
  } catch (error) {
    throw new Error(`Invalid YAML in ${file}: ${(error as Error).message}`);
  }
  return parsePromotionContract(value, file);
}

export async function loadPromotionEvidence(file: string): Promise<PromotionEvidence> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    throw new Error(`Promotion evidence not found: ${file}.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${file}: ${(error as Error).message}`);
  }
  return parsePromotionEvidence(value, file);
}

function stale(completedAt: string, observedAt: string, maxAgeHours: number | undefined): boolean {
  if (maxAgeHours === undefined) return false;
  return Date.parse(observedAt) - Date.parse(completedAt) > maxAgeHours * 60 * 60 * 1000;
}

function issue(
  code: string,
  stage: Exclude<PromotionStage, 'merge-ready'>,
  kind: PromotionIssueKind,
  message: string,
): PromotionIssue {
  return { code, stage, kind, message };
}

function acceptanceRequired(contract: PromotionContract, riskLevel: string): boolean {
  if (contract.manualAcceptance.mode === 'always') return true;
  if (contract.manualAcceptance.mode === 'never') return false;
  return (contract.manualAcceptance.riskLevels ?? []).includes(riskLevel);
}

export function evaluatePromotion(
  contract: PromotionContract,
  evidence: PromotionEvidence,
  pathPolicy?: GateConfig,
): PromotionDecision {
  const problems: PromotionIssue[] = [];
  const pr = evidence.pullRequest;
  const sha = pr.headSha;

  if (pr.draft) problems.push(issue('draft', 'intake', 'waiting', 'Pull request is still a draft.'));
  if (pr.changedPaths.length === 0) {
    problems.push(issue('changed-paths-missing', 'intake', 'blocked', 'No changed paths were supplied for policy evaluation.'));
  }
  if (!contract.pullRequest.baseBranches.includes(pr.baseBranch)) {
    problems.push(issue('base-branch', 'intake', 'blocked', `Base branch ${pr.baseBranch} is not allowed.`));
  }
  if (contract.pullRequest.sameRepositoryOnly && pr.headRepository !== pr.baseRepository) {
    problems.push(issue('fork', 'intake', 'human-required', 'Auto-merge is disabled for fork pull requests.'));
  }
  if (pr.attempts >= contract.pullRequest.maxAttempts) {
    problems.push(
      issue(
        'attempt-limit',
        'intake',
        'human-required',
        `Attempt limit reached (${pr.attempts}/${contract.pullRequest.maxAttempts}).`,
      ),
    );
  }
  const missingLabels = contract.authorization.labels.filter((label) => !pr.labels.includes(label));
  if (missingLabels.length > 0) {
    problems.push(
      issue('authorization-label', 'intake', 'human-required', `Missing authorization label(s): ${missingLabels.join(', ')}.`),
    );
  }

  if (pathPolicy) {
    const decision = checkGate({ config: pathPolicy, action: 'auto-merge', paths: pr.changedPaths });
    if (!decision.allowed) problems.push(issue(`path-${decision.trigger}`, 'policy', 'human-required', decision.reason));
  }

  if (contract.pullRequest.requireCleanMerge && pr.mergeState.toLowerCase() !== 'clean') {
    problems.push(issue('merge-state', 'review', 'waiting', `Merge state is ${pr.mergeState}, not CLEAN.`));
  }
  if (pr.approvals < contract.authorization.minApprovals) {
    problems.push(
      issue(
        'approvals',
        'review',
        'human-required',
        `Approvals ${pr.approvals}/${contract.authorization.minApprovals}.`,
      ),
    );
  } else if (contract.authorization.minApprovals > 0 && pr.approvalSha !== sha) {
    problems.push(
      issue('approval-sha', 'review', 'human-required', 'Counted approvals are not for the current PR HEAD SHA.'),
    );
  }
  if (pr.changesRequested) {
    problems.push(issue('changes-requested', 'review', 'human-required', 'A review still requests changes.'));
  }
  if (contract.pullRequest.requireResolvedThreads && pr.unresolvedThreads > 0) {
    problems.push(
      issue('review-threads', 'review', 'human-required', `${pr.unresolvedThreads} review thread(s) remain unresolved.`),
    );
  }

  for (const required of contract.checks.required) {
    const matchingChecks = evidence.checks.filter((candidate) => candidate.name === required && candidate.sha === sha);
    const check = matchingChecks[0];
    if (matchingChecks.length > 1) {
      problems.push(issue('check-ambiguous', 'checks', 'blocked', `Required check ${required} has duplicate evidence.`));
    } else if (!check) {
      problems.push(issue('check-missing', 'checks', 'waiting', `Required check ${required} has no evidence for ${sha}.`));
    } else if (check.status === 'pending') {
      problems.push(issue('check-pending', 'checks', 'waiting', `Required check ${required} is pending.`));
    } else if (check.status === 'failure') {
      problems.push(issue('check-failed', 'checks', 'blocked', `Required check ${required} failed.`));
    }
  }

  if (contract.deployment.required) {
    const deployment = evidence.deployment;
    if (!deployment) {
      problems.push(issue('deployment-missing', 'deployment', 'waiting', 'No deployment evidence was supplied.'));
    } else {
      if (deployment.environment !== contract.deployment.environment) {
        problems.push(
          issue(
            'deployment-environment',
            'deployment',
            'blocked',
            `Expected environment ${contract.deployment.environment}, got ${deployment.environment}.`,
          ),
        );
      }
      if (deployment.sha !== sha) {
        problems.push(issue('deployment-sha', 'deployment', 'waiting', 'Deployment does not match the current PR HEAD SHA.'));
      }
      if (deployment.status !== 'success') {
        problems.push(
          issue(
            `deployment-${deployment.status}`,
            'deployment',
            deployment.status === 'pending' ? 'waiting' : 'blocked',
            `Deployment status is ${deployment.status}.`,
          ),
        );
      }
      if (stale(deployment.completedAt, evidence.observedAt, contract.deployment.maxAgeHours)) {
        problems.push(issue('deployment-stale', 'deployment', 'waiting', 'Deployment evidence is stale.'));
      }
    }
  }

  if (contract.testData.required) {
    const data = evidence.testData;
    if (!data) {
      problems.push(issue('test-data-missing', 'test-data', 'waiting', 'No test-data evidence was supplied.'));
    } else {
      if (!contract.testData.allowedKinds.includes(data.kind)) {
        problems.push(
          issue('test-data-kind', 'test-data', 'human-required', `Dataset kind ${data.kind} is not permitted.`),
        );
      }
      if (contract.testData.requireVersion && !data.version) {
        problems.push(issue('test-data-version', 'test-data', 'blocked', 'Dataset version is required.'));
      }
      if (data.sha !== sha) {
        problems.push(issue('test-data-sha', 'test-data', 'waiting', 'Test data was not seeded for the current PR SHA.'));
      }
      if (data.status !== 'success') {
        problems.push(
          issue(
            `test-data-${data.status}`,
            'test-data',
            data.status === 'pending' ? 'waiting' : 'blocked',
            `Test-data reset/seed status is ${data.status}.`,
          ),
        );
      }
    }
  }

  const requiredSuites = new Set(contract.e2e.requiredSuites);
  for (const rule of contract.e2e.pathSuites ?? []) {
    if (pr.changedPaths.some((path) => rule.paths.some((glob) => minimatch(path, glob, { dot: true })))) {
      for (const suite of rule.suites) requiredSuites.add(suite);
    }
  }
  for (const requiredSuite of requiredSuites) {
    const matchingSuites = evidence.e2e.filter((candidate) => candidate.suite === requiredSuite && candidate.sha === sha);
    const suite = matchingSuites[0];
    if (matchingSuites.length > 1) {
      problems.push(issue('e2e-ambiguous', 'e2e', 'blocked', `E2E suite ${requiredSuite} has duplicate evidence.`));
      continue;
    }
    if (!suite) {
      problems.push(issue('e2e-missing', 'e2e', 'waiting', `E2E suite ${requiredSuite} has no evidence for ${sha}.`));
      continue;
    }
    if (suite.status !== 'success') {
      problems.push(
        issue(
          `e2e-${suite.status}`,
          'e2e',
          suite.status === 'pending' ? 'waiting' : 'blocked',
          `E2E suite ${requiredSuite} is ${suite.status}.`,
        ),
      );
    }
    if (
      contract.e2e.requireDatasetMatch &&
      evidence.testData?.version &&
      suite.datasetVersion !== evidence.testData.version
    ) {
      problems.push(
        issue('e2e-dataset', 'e2e', 'blocked', `E2E suite ${requiredSuite} used a different dataset version.`),
      );
    }
    if (stale(suite.completedAt, evidence.observedAt, contract.e2e.maxAgeHours)) {
      problems.push(issue('e2e-stale', 'e2e', 'waiting', `E2E suite ${requiredSuite} evidence is stale.`));
    }
  }

  if (acceptanceRequired(contract, pr.riskLevel)) {
    const acceptance = evidence.manualAcceptance;
    if (!acceptance) {
      problems.push(issue('acceptance-missing', 'acceptance', 'human-required', 'Manual acceptance is required.'));
    } else {
      if (acceptance.sha !== sha) {
        problems.push(issue('acceptance-sha', 'acceptance', 'human-required', 'Acceptance is for an older PR SHA.'));
      }
      if (acceptance.status !== 'success') {
        problems.push(
          issue(
            `acceptance-${acceptance.status}`,
            'acceptance',
            acceptance.status === 'pending' ? 'human-required' : 'blocked',
            `Manual acceptance status is ${acceptance.status}.`,
          ),
        );
      }
      if (!acceptance.actor) {
        problems.push(issue('acceptance-actor', 'acceptance', 'human-required', 'Acceptance actor is not recorded.'));
      }
      if (stale(acceptance.completedAt, evidence.observedAt, contract.manualAcceptance.maxAgeHours)) {
        problems.push(issue('acceptance-stale', 'acceptance', 'human-required', 'Manual acceptance evidence is stale.'));
      }
    }
  }

  const first = problems[0];
  return {
    allowed: problems.length === 0,
    stage: first?.stage ?? 'merge-ready',
    headSha: sha,
    pullRequest: pr.number,
    issues: problems,
    summary:
      problems.length === 0
        ? `PR #${pr.number} at ${sha} has fresh evidence for every promotion gate.`
        : `PR #${pr.number} at ${sha} is not merge-ready: ${problems.length} gate issue(s).`,
  };
}
