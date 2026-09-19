import type { Passage } from './retrieve.js';
import type { ClassifyInput } from './classify.js';
export declare function readStdin(): Promise<string>;
export declare function readTextArg(value: string | undefined): Promise<string>;
export declare function loadPassages(file: string): Promise<Passage[]>;
export declare function loadClassifyInput(file: string): Promise<ClassifyInput>;
