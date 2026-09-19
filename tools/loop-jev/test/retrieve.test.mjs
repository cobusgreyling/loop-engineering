import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicRetrieve, retrieveContext } from '../dist/retrieve.js';

test('heuristic retrieve ranks overlapping passages first', () => {
  const result = heuristicRetrieve({
    query: 'path denylist for .env files',
    passages: [
      { id: 'a', text: 'How to write a changelog' },
      { id: 'b', text: 'The path denylist forbids editing .env and secrets' },
      { id: 'c', text: 'Worktrees isolate each attempt' },
    ],
    minRelevance: 0.5,
  });
  assert.equal(result.ranked[0].id, 'b');
  assert.equal(result.kept[0].id, 'b');
  assert.equal(result.source, 'fallback');
});

test('retrieveContext uses Jev probabilities and per-passage scores', async () => {
  const systemOne = async (req) => {
    assert.equal(typeof req.state.query, 'string');
    return {
      model: 'jev-1.13.0',
      answers: {
        which: {
          type: 'choice',
          choice: 'gate',
          probabilities: { gate: 0.7, cost: 0.2, other: 0.1 },
          confidence: 0.8,
        },
        contains_answer: { type: 'noul', noul: 0.91 },
        'rel::gate': { type: 'score', score: 2.6, confidence: 0.8 },
        'rel::cost': { type: 'score', score: 1.1, confidence: 0.6 },
        'rel::other': { type: 'score', score: 0.2, confidence: 0.7 },
      },
    };
  };

  const result = await retrieveContext(
    {
      query: 'how does the denylist work?',
      passages: [
        { id: 'gate', text: 'loop-gate enforces denylist globs' },
        { id: 'cost', text: 'loop-cost estimates tokens' },
        { id: 'other', text: 'star history badge' },
      ],
    },
    { systemOne },
  );

  assert.equal(result.source, 'jev');
  assert.equal(result.containsAnswer, 0.91);
  assert.equal(result.ranked[0].id, 'gate');
  assert.ok(result.kept.some((p) => p.id === 'gate'));
});
