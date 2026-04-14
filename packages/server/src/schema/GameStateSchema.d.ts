import { Schema, MapSchema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";
export declare class GameStateSchema extends Schema {
    phase: string;
    publicData: string;
    roomCode: string;
    players: MapSchema<PlayerSchema, string>;
}
//# sourceMappingURL=GameStateSchema.d.ts.map