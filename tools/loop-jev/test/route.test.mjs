import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicRoute, routeTask } from '../dist/route.js';

test('heuristic routes typos to nano and verifiers to reasoning', () => {
  const typo = heuristicRoute({ goal: 'Fix a typo in README', files: ['README.md'] });
  assert.equal(typo.tier, 'nano');
  assert.equal(typo.source, 'fallback');

  const verify = heuristicRoute({ goal: 'Run the verifier over this security patch', level: 'L3' });
  assert.equal(verify.tier, 'reasoning');
});

test('routeTask uses Jev answers and downgrades low-confidence frontier to balanced', async () => {
  const systemOne = async () => ({
    model: 'jev-1.13.0',
    answers: {
      tier: {
        type: 'choice',
        choice: 'frontier',
        probabilities: { nano: 0.1, fast: 0.2, balanced: 0.25, frontier: 0.3, reasoning: 0.15 },
        confidence: 0.28,
      },
      difficulty: { type: 'score', score: 2.1, confidence: 0.5 },
      needs_tools: { type: 'noul', noul: 0.9 },
      needs_long_context: { type: 'noul', noul: 0.4 },
      needs_maker_checker: { type: 'noul', noul: 0.8 },
    },
    usage: { input_tokens: 100, output_tokens: 20 },
  });

  const decision = await routeTask({ goal: 'CI has been red for 3 days' }, { systemOne });
  assert.equal(decision.source, 'jev');
  assert.equal(decision.uncertain, true);
  assert.equal(decision.tier, 'balanced');
  assert.equal(decision.model, 'claude-sonnet');
  assert.equal(decision.needsMakerChecker, 0.8);
});

test('routeTask honors a confident nano pick', async () => {
  const systemOne = async () => ({
    model: 'jev-1.13.0',
    answers: {
      tier: {
        type: 'choice',
        choice: 'nano',
        probabilities: { nano: 0.92, fast: 0.05, balanced: 0.02, frontier: 0.01, reasoning: 0 },
        confidence: 0.88,
      },
      difficulty: { type: 'score', score: 0.1, confidence: 0.9 },
      needs_tools: { type: 'noul', noul: 0.2 },
      needs_long_context: { type: 'noul', noul: 0.1 },
      needs_maker_checker: { type: 'noul', noul: 0.05 },
    },
  });
  const decision = await routeTask({ goal: 'rename a variable' }, { systemOne });
  assert.equal(decision.tier, 'nano');
  assert.equal(decision.uncertain, false);
});
