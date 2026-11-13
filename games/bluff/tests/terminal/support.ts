import { PlayerSchema } from "@partygame/shared/schema";
import { BluffOption, type BluffState, PlayerPrivate } from "../../src/state.js";

export const ME = "me-0000001";

export { freePort } from "@partygame/server/probe";

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const seat = (
  state: BluffState,
  id: string,
  name = id,
  role: "host" | "player" = "player",
): void => {
  state.players.set(id, Object.assign(new PlayerSchema(), { id, name, role }));
};

export const choice = (id: string, text: string, over: Partial<BluffOption> = {}): BluffOption =>
  Object.assign(new BluffOption(), { id, text, ...over });

export const mine = (
  state: BluffState,
  id: string,
  over: Partial<PlayerPrivate> = {},
): PlayerPrivate => {
  const entry = Object.assign(new PlayerPrivate(), over);
  state.mine.set(id, entry);
  return entry;
};
