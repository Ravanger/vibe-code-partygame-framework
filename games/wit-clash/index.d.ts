export interface WitClashState {
  scores: Record<string, number>;
  prompts: Record<string, string>;
  votes: Record<string, number>;
  category: string;
  phase: string;
}
export declare const WitClashGame: import("@partygame/core").GameDefinition<WitClashState, unknown>;
//# sourceMappingURL=index.d.ts.map
