import { GameClient } from "./GameClient.js";

export { Countdown } from "./countdown.svelte.js";
export { GameClient } from "./GameClient.js";
export { CategoryVoteViewModel } from "./viewmodels/CategoryVoteViewModel.svelte.js";

export function createGameClient(options: { endpoint: string }) {
  return new GameClient(options);
}
