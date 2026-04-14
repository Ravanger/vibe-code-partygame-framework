import { GameClient } from "./GameClient.js";

export { GameClient } from "./GameClient.js";


export function createGameClient(options: { roomCode: string }) {
  return new GameClient(options);
}
