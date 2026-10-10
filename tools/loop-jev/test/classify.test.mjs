import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicClassify, classifyTrace, classifyExitCode } from '../dist/classify.js';

test('heuristic classify maps budget and policy events', () => {
  const budget = heuristicClassify({
    events: [
      { type: 'turn.start' },
      { type: 'budget.exceeded', detail: 'tokens=100001/100000' },
    ],
  });
  assert.equal(budget.failureMode, 'budget_burn');
  assert.equal(classifyExitCode(budget), 2);

  const policy = heuristicClassify({
    events: [{ type: 'policy.denied', detail: '.env' }],
  });
  assert.equal(policy.failureMode, 'policy_denied');

  const healthy = heuristicClassify({
    events: [
      { type: 'session.start' },
      { type: 'turn.end', detail: 'done' },
      { type: 'session.end' },
    ],
  });
  assert.equal(healthy.failureMode, 'healthy');
  assert.equal(classifyExitCode(healthy), 0);
});

test('heuristic classify detects a tool loop', () => {
  const events = [];
  for (let i = 0; i < 8; i += 1) {
    events.push({ type: 'tool.call', detail: 'run_command npm test' });
  }
  const decision = heuristicClassify({ events });
  assert.equal(decision.failureMode, 'tool_loop');
});

test('classifyTrace uses Jev choice + nouls', async () => {
  const systemOne = async () => ({
    model: 'jev-1.13.0',
    answers: {
      failure_mode: {
        type: 'choice',
        choice: 'stagnation',
        probabilities: { stagnation: 0.8, healthy: 0.1, other: 0.1 },
        confidence: 0.77,
      },
      recovery_urgency: { type: 'score', score: 2.1, confidence: 0.7 },
      should_escalate: { type: 'noul', noul: 0.88 },
      needs_maker_checker: { type: 'noul', noul: 0.4 },
      context_rot: { type: 'noul', noul: 0.7 },
    },
  });
  const decision = await classifyTrace({ events: [{ type: 'error', detail: 'same error' }] }, { systemOne });
  assert.equal(decision.source, 'jev');
  assert.equal(decision.failureMode, 'stagnation');
  assert.equal(decision.shouldEscalate, 0.88);
  assert.equal(classifyExitCode(decision), 2);
});
