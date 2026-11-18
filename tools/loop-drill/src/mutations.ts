/**
 * Mutation operators for the verifier canary.
 *
 * The canary needs a defect a competent verifier should reject. Rather than
 * asking a model to invent one (which makes the drill non-deterministic and
 * costs tokens), we borrow mutation testing: apply a small, mechanical,
 * behaviour-changing edit to real source and see whether the verifier notices.
 *
 * Operators are deliberately restricted to edits that change runtime behaviour
 * in every C-family language, and that a reviewer would call a bug rather than
 * a style choice. Anything ambiguous (`<` -> `>`, which breaks TS generics and
 * JSX; `+` -> `-`, which silently mangles string concatenation) is excluded:
 * a false mutant would report a verifier as broken when it was right to
 * approve.
 */

export interface MutationOperator {
  id: string;
  description: string;
  /** Matches the token to mutate. Must be global. */
  pattern: RegExp;
  replace: string;
}

/**
 * Order matters: the first operator with a match in a file wins, so the
 * least ambiguous edits come first.
 */
export const OPERATORS: MutationOperator[] = [
  {
    id: 'strict-equality-flip',
    description: 'flip === to !==',
    pattern: /===/g,
    replace: '!==',
  },
  {
    id: 'strict-inequality-flip',
    description: 'flip !== to ===',
    pattern: /!==/g,
    replace: '===',
  },
  {
    id: 'boundary-off-by-one',
    description: 'weaken <= to <',
    pattern: /<=/g,
    replace: '<',
  },
  {
    id: 'boundary-off-by-one-gte',
    description: 'weaken >= to >',
    pattern: />=/g,
    replace: '>',
  },
  {
    id: 'logical-and-to-or',
    description: 'flip && to ||',
    pattern: /&&/g,
    replace: '||',
  },
  {
    id: 'return-true-to-false',
    description: 'flip `return true` to `return false`',
    pattern: /\breturn true\b/g,
    replace: 'return false',
  },
  {
    id: 'return-false-to-true',
    description: 'flip `return false` to `return true`',
    pattern: /\breturn false\b/g,
    replace: 'return true',
  },
];

export interface Mutant {
  operator: MutationOperator;
  /** Repo-relative path of the mutated file. */
  file: string;
  mutated: string;
  /** 1-based line number of the edit, for the report. */
  line: number;
  /** The line before and after, for the report. */
  before: string;
  after: string;
}

/**
 * Apply the first applicable operator to `content`, mutating only the first
 * occurrence. One edit per mutant keeps the signal clean: if the verifier
 * rejects, it rejected *this* defect.
 *
 * Skips occurrences that are not code — inside a comment, a string or a
 * template literal. A verifier is right not to care about a flipped operator in
 * prose, and crediting it for catching one would overstate the result, while a
 * mutant that changed nothing it could see would understate it.
 */
export function mutate(content: string, file: string, operators = OPERATORS): Mutant | null {
  const mask = codeMask(content);
  for (const operator of operators) {
    const pattern = new RegExp(operator.pattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const index = match.index;
      if (!isCode(mask, index, match[0].length)) continue;

      const mutated = content.slice(0, index) + operator.replace + content.slice(index + match[0].length);
      const line = content.slice(0, index).split('\n').length;
      return {
        operator,
        file,
        mutated,
        line,
        before: lineAt(content, line).trim(),
        after: lineAt(mutated, line).trim(),
      };
    }
  }
  return null;
}

function isCode(mask: Uint8Array, index: number, length: number): boolean {
  for (let at = index; at < index + length; at += 1) if (mask[at] !== 1) return false;
  return true;
}

function lineAt(content: string, line: number): string {
  return content.split('\n')[line - 1] ?? '';
}

/**
 * Which characters are code. A token inside a line comment, a block comment, a
 * string or a template literal is text: flipping it changes nothing the
 * verifier could notice, so the mutant would report a healthy verifier as
 * broken -- the one outcome these operators exist to avoid. Line comments were
 * already handled; the other three are the same case.
 */
function codeMask(content: string): Uint8Array {
  const mask = new Uint8Array(content.length);
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template';
  let state: State = 'code';
  for (let at = 0; at < content.length; at += 1) {
    const char = content[at];
    const next = content[at + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        at += 1;
      } else if (char === '/' && next === '*') {
        state = 'block';
        at += 1;
      } else if (char === '#' && (at === 0 || /\s/.test(content[at - 1]))) {
        // `#` opens a comment in shell, Python and Ruby, but `this.#x` is code.
        state = 'line';
      } else if (char === "'") {
        state = 'single';
      } else if (char === '"') {
        state = 'double';
      } else if (char === '`') {
        state = 'template';
      } else {
        mask[at] = 1;
      }
      continue;
    }
    if (state === 'line') {
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        at += 1;
      }
      continue;
    }
    // Inside a string or a template literal: only the closing delimiter and an
    // escape matter.
    if (char === '\\') {
      at += 1;
    } else if (state === 'single' && char === "'") {
      state = 'code';
    } else if (state === 'double' && char === '"') {
      state = 'code';
    } else if (state === 'template' && char === '`') {
      state = 'code';
    } else if (char === '\n' && state !== 'template') {
      // A quote that never closes is broken source; it must not hide the rest
      // of the file from the canary.
      state = 'code';
    }
  }
  return mask;
}

/**
 * Files worth mutating: real source, not build output, vendored code, tests,
 * or generated artifacts. Mutating a test file would make the canary trivially
 * easy (the suite fails loudly); mutating dist/ would make it meaningless
 * (nothing reads it).
 */
const SKIP_DIRECTORIES = /(^|\/)(node_modules|dist|build|out|coverage|vendor|\.git|__snapshots__)(\/|$)/;
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|java|go|rs|c|cc|cpp|cs|kt|swift|php|rb)$/;
const TEST_FILE = /(^|\/)(test|tests|spec|__tests__)(\/|$)|\.(test|spec)\.[a-z]+$/;

export function isMutationCandidate(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  if (SKIP_DIRECTORIES.test(normalized)) return false;
  if (TEST_FILE.test(normalized)) return false;
  return SOURCE_EXTENSIONS.test(normalized);
}
