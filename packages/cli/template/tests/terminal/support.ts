import { PlayerSchema } from "@partygame/shared/schema";
import type { __PascalName__State } from "../../src/state.js";

export const ME = "me-0000001";

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const seat = (
  state: __PascalName__State,
  id: string,
  name = id,
  role: "host" | "player" = "player",
): void => {
  state.players.set(id, Object.assign(new PlayerSchema(), { id, name, role }));
};
