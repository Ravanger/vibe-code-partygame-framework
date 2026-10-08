import { type SchemaType, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const __PascalName__State = BaseGameState.extend(
  {
    waves: t.map("number"),
    winnerName: t.string().default(""),
    winnerWaves: t.number().default(0),
  },
  "__PascalName__State",
);
export type __PascalName__State = SchemaType<typeof __PascalName__State>;
