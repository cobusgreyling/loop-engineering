import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mutate, isMutationCandidate, OPERATORS } from '../dist/mutations.js';

describe('mutate', () => {
  test('flips the first === it finds', () => {
    const m = mutate('const ok = a === b;\n', 'src/a.ts');
    assert.equal(m.operator.id, 'strict-equality-flip');
    assert.equal(m.mutated, 'const ok = a !== b;\n');
    assert.equal(m.line, 1);
  });

  test('mutates only the first occurrence, so one mutant means one defect', () => {
    const m = mutate('a === b;\nc === d;\n', 'src/a.ts');
    assert.equal(m.mutated, 'a !== b;\nc === d;\n');
  });

  test('reports the line number and the before/after text', () => {
    const m = mutate('line one\nconst n = x <= y;\n', 'src/a.ts');
    assert.equal(m.line, 2);
    assert.equal(m.before, 'const n = x <= y;');
    assert.equal(m.after, 'const n = x < y;');
  });

  test('skips a match inside a // comment', () => {
    const m = mutate('// a === b is fine\nreturn c === d;\n', 'src/a.ts');
    assert.equal(m.line, 2);
    assert.equal(m.mutated, '// a === b is fine\nreturn c !== d;\n');
  });

  test('skips a match inside a # comment', () => {
    const m = mutate('# x <= y\nif a <= b:\n', 'src/a.py');
    assert.equal(m.line, 2);
  });

  test('returns null when nothing is mutable', () => {
    assert.equal(mutate('const greeting = "hello";\n', 'src/a.ts'), null);
  });

  test('flips boolean returns', () => {
    const m = mutate('function isValid() { return true; }\n', 'src/a.ts');
    assert.equal(m.operator.id, 'return-true-to-false');
    assert.match(m.mutated, /return false/);
  });

  test('flips && to ||', () => {
    const m = mutate('if (a && b) run();\n', 'src/a.ts');
    assert.equal(m.operator.id, 'logical-and-to-or');
    assert.equal(m.mutated, 'if (a || b) run();\n');
  });

  test('every operator actually changes the content it matches', () => {
    for (const op of OPERATORS) {
      assert.notEqual(op.replace, op.pattern.source, `operator ${op.id} is a no-op`);
    }
  });

  test('excludes ambiguous operators that would produce false mutants', () => {
    // `<` -> `>` breaks TS generics and JSX; `+` -> `-` mangles string
    // concatenation. Either would make a correct verifier look broken.
    const ids = OPERATORS.map((o) => o.id);
    assert.ok(!ids.includes('less-than-flip'));
    assert.ok(!ids.includes('arithmetic-flip'));
  });
});

describe('isMutationCandidate', () => {
  test('accepts ordinary source', () => {
    assert.ok(isMutationCandidate('src/index.ts'));
    assert.ok(isMutationCandidate('app/main/Service.java'));
    assert.ok(isMutationCandidate('pkg/server.go'));
  });

  test('rejects build output and dependencies', () => {
    assert.ok(!isMutationCandidate('dist/index.js'));
    assert.ok(!isMutationCandidate('node_modules/left-pad/index.js'));
    assert.ok(!isMutationCandidate('coverage/lcov-report/app.js'));
    assert.ok(!isMutationCandidate('vendor/lib.go'));
  });

  test('rejects tests — mutating them would make the canary trivial', () => {
    assert.ok(!isMutationCandidate('test/app.test.mjs'));
    assert.ok(!isMutationCandidate('src/__tests__/app.js'));
    assert.ok(!isMutationCandidate('spec/thing.spec.ts'));
  });

  test('rejects non-source files', () => {
    assert.ok(!isMutationCandidate('README.md'));
    assert.ok(!isMutationCandidate('package.json'));
    assert.ok(!isMutationCandidate('gate.yaml'));
  });

  test('normalizes Windows separators', () => {
    assert.ok(!isMutationCandidate('dist\\index.js'));
    assert.ok(isMutationCandidate('src\\index.ts'));
  });
});

describe('mutate only edits code, never text that looks like code', () => {
  test('skips a match inside a /* */ block comment', () => {
    const m = mutate('/* keep a === b as documentation */\nconst ok = c === d;\n', 'src/a.ts');
    assert.equal(m.line, 2);
    assert.equal(m.mutated, '/* keep a === b as documentation */\nconst ok = c !== d;\n');
  });

  test('skips a match inside a string literal', () => {
    const m = mutate('const label = "a === b";\nconst ok = c === d;\n', 'src/a.ts');
    assert.equal(m.line, 2);
  });

  test('skips a match inside a template literal', () => {
    const m = mutate('const msg = `a === b`;\nconst ok = c === d;\n', 'src/a.ts');
    assert.equal(m.line, 2);
  });

  test('a file whose only operators are in text has no mutant at all', () => {
    assert.equal(mutate('export const label = "a === b";\n', 'src/a.ts'), null);
    assert.equal(mutate('/* a !== b */\nexport const done = 1;\n', 'src/a.ts'), null);
  });

  test('a string ends at its closing quote and the code after it is mutable again', () => {
    const m = mutate('const label = "a === b"; if (x === y) run();\n', 'src/a.ts');
    assert.equal(m.line, 1);
    assert.equal(m.after, 'const label = "a === b"; if (x !== y) run();');
  });

  test('an escaped quote does not end the string early', () => {
    const m = mutate('const q = "a \\" === b";\nconst ok = c === d;\n', 'src/a.ts');
    assert.equal(m.line, 2);
  });
});
