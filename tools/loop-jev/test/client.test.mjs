import { test } from 'node:test';
import assert from 'node:assert/strict';
import { systemOne, TypeSafeError } from '../dist/client.js';

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

test('systemOne redacts secrets in the request body and never sends them', async () => {
  const bodies = [];
  const fetch = async (_url, init) => {
    bodies.push(init.body);
    return jsonResponse(200, {
      model: 'jev-1.13.0',
      answers: { ok: { type: 'noul', noul: 0.9 } },
      usage: { input_tokens: 10, output_tokens: 2 },
    });
  };

  await systemOne(
    {
      state: { note: 'here is apikey_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      questions: { ok: { type: 'noul', instructions: 'ok?' } },
    },
    { apiKey: 'test-key-value', fetch },
  );

  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].includes('apikey_'), false);
  assert.equal(bodies[0].includes('[REDACTED]'), true);
  assert.equal(bodies[0].includes('test-key-value'), false);
});

test('systemOne retries 429 then succeeds', async () => {
  let n = 0;
  const fetch = async () => {
    n += 1;
    if (n === 1) return jsonResponse(429, { error: 'slow down' }, { 'retry-after': '0' });
    return jsonResponse(200, { model: 'jev-1.13.0', answers: { x: { type: 'noul', noul: 1 } } });
  };
  const res = await systemOne(
    { state: 'hi', questions: { x: { type: 'noul', instructions: 'yes?' } } },
    { apiKey: 'test-key-value', fetch, retries: 2 },
  );
  assert.equal(n, 2);
  assert.equal(res.answers.x.noul, 1);
});

test('systemOne throws TypeSafeError without echoing the key', async () => {
  const fetch = async () => jsonResponse(401, { error: 'nope' });
  await assert.rejects(
    () =>
      systemOne(
        { state: 'hi', questions: { x: { type: 'noul', instructions: 'yes?' } } },
        { apiKey: 'super-secret-key-value', fetch },
      ),
    (err) => {
      assert.equal(err instanceof TypeSafeError, true);
      assert.equal(err.status, 401);
      assert.equal(String(err.message).includes('super-secret-key-value'), false);
      return true;
    },
  );
});
