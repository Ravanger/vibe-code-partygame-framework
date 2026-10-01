/** Phase names shared by the server phases and the UI screen map. `Lobby` is the framework's own. */
export const PHASE = {
  CategorySelection: "CategorySelection",
  Prompting: "Prompting",
  MatchupVoting: "MatchupVoting",
  MatchupReveal: "MatchupReveal",
  Results: "Results",
  TieBreakerPrompting: "TieBreakerPrompting",
  TieBreakerVoting: "TieBreakerVoting",
  TieBreakerReveal: "TieBreakerReveal",
} as const;

export type PhaseName = (typeof PHASE)[keyof typeof PHASE];
