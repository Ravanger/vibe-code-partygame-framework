/**
 * Remove // and /* *\/ comments from JSON text WITHOUT touching comment-like
 * sequences inside string literals. A naive regex corrupts prompts containing "https://".
 */
export declare function stripJsonComments(input: string): string;
//# sourceMappingURL=stripJsonComments.d.ts.map
