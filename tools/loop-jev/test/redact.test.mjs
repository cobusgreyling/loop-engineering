import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, redactString, containsSecret, REDACTED } from '../dist/redact.js';

test('redacts TypeSafe-shaped keys and common tokens', () => {
  const sample = 'prefix apikey_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb suffix';
  const out = redactString(sample);
  assert.equal(out.includes('apikey_'), false);
  assert.equal(out.includes(REDACTED), true);
  assert.equal(containsSecret(sample), true);
  assert.equal(containsSecret(out), false);
});

test('redacts nested objects keyed as secrets', () => {
  const out = redactSecrets({
    goal: 'fix the test',
    TYPESAFE_API_KEY: 'should-not-leak',
    nested: { token: 'abc12345678', note: 'ok' },
  });
  assert.equal(out.TYPESAFE_API_KEY, REDACTED);
  assert.equal(out.nested.token, REDACTED);
  assert.equal(out.nested.note, 'ok');
  assert.equal(out.goal, 'fix the test');
});
