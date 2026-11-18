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
export declare const OPERATORS: MutationOperator[];
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
export declare function mutate(content: string, file: string, operators?: MutationOperator[]): Mutant | null;
export declare function isMutationCandidate(relativePath: string): boolean;
