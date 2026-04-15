import { GameClient } from "./GameClient.js";

export { GameClient } from "./GameClient.js";

export function createGameClient(options: { endpoint: string }) {
  return new GameClient(options);
}
