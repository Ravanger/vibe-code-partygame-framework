/** Phase names shared by the server phases and the UI screen map. `Lobby` is the framework's own. */
export const PHASE = {
  Waving: "Waving",
  Results: "Results",
} as const;

export type PhaseName = (typeof PHASE)[keyof typeof PHASE];
