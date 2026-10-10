/**
 * TypeSafe System One HTTP client.
 *
 * Auth: TYPESAFE_API_KEY, JEV_API_KEY, or ~/.config/typesafe/api_key
 * (override path with TYPESAFE_KEY_FILE). The key is never logged or returned.
 */
import type { Answer, Questions } from './questions.js';
export declare const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export declare const DEFAULT_MODEL = "jev-latest";
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type SystemOneRequest = {
    state: unknown;
    questions: Questions;
    model?: string;
};
export type SystemOneResponse = {
    model: string;
    answers: Record<string, Answer>;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export type SystemOneFn = (req: SystemOneRequest) => Promise<SystemOneResponse>;
export type ClientOptions = {
    apiKey?: string;
    endpoint?: string;
    model?: string;
    fetch?: FetchLike;
    retries?: number;
};
export declare function keyFilePath(): string;
export declare function resolveApiKey(explicit?: string): Promise<string | undefined>;
export declare function keyIsConfigured(key?: string): boolean;
export declare function describeKeySource(): 'env' | 'file' | 'none';
export declare class TypeSafeError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function systemOne(req: SystemOneRequest, opts?: ClientOptions): Promise<SystemOneResponse>;
export declare function createClient(opts?: ClientOptions): SystemOneFn;
