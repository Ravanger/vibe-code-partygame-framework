import { getContext, setContext } from "svelte";
import type { GameClient } from "./GameClient.js";

const CLIENT_KEY = Symbol("GAME_CLIENT");

export function provideGameClient(client: GameClient) {
  setContext(CLIENT_KEY, client);
}

export function useGameClient(): GameClient {
  return getContext(CLIENT_KEY);
}
