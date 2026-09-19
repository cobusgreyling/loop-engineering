import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessTurn } from '../dist/turn.js';

test('assessTurn fans routing and guard questions into one call', async () => {
  let calls = 0;
  const systemOne = async (req) => {
    calls += 1;
    assert.ok(req.questions.tier);
    assert.ok(req.questions.jailbreak);
    return {
      model: 'jev-1.13.0',
      answers: {
        tier: {
          type: 'choice',
          choice: 'fast',
          probabilities: { nano: 0.1, fast: 0.8, balanced: 0.1, frontier: 0, reasoning: 0 },
          confidence: 0.84,
        },
        difficulty: { type: 'score', score: 0.9, confidence: 0.8 },
        needs_tools: { type: 'noul', noul: 0.2 },
        needs_long_context: { type: 'noul', noul: 0.1 },
        needs_maker_checker: { type: 'noul', noul: 0.1 },
        jailbreak: { type: 'noul', noul: 0.02 },
        prompt_injection: { type: 'noul', noul: 0.01 },
        secret_exfil: { type: 'noul', noul: 0.01 },
        denylist_pressure: { type: 'noul', noul: 0.02 },
        harmful_request: { type: 'noul', noul: 0.01 },
        severity: { type: 'score', score: 0.1, confidence: 0.9 },
      },
      usage: { input_tokens: 200, output_tokens: 40 },
    };
  };

  const decision = await assessTurn(
    { goal: 'Draft the daily triage report', message: 'Summarize open PRs' },
    { systemOne },
  );
  assert.equal(calls, 1);
  assert.equal(decision.source, 'jev');
  assert.equal(decision.action, 'pass');
  assert.equal(decision.route.tier, 'fast');
});
