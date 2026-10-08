import { ACTION } from "../../src/actionNames.js";
import type { __PascalName__Manager } from "../manager.js";

export interface WaveRow {
  id: string;
  name: string;
  waves: number;
  isMe: boolean;
}

/** The live wave board and the button that adds to it. */
export class WavingViewModel {
  constructor(private readonly manager: __PascalName__Manager) {}

  /** A fresh snapshot, highest count first, ties by name. */
  get rows(): WaveRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.players.values()]
      .map((seat) => ({
        id: seat.id,
        name: seat.name,
        waves: state.waves.get(seat.id) ?? 0,
        isMe: seat.id === this.manager.playerId,
      }))
      .sort((a, b) => b.waves - a.waves || a.name.localeCompare(b.name));
  }

  get myWaves(): number {
    const state = this.manager.state;
    return state?.waves.get(this.manager.playerId) ?? 0;
  }

  async wave(): Promise<void> {
    await this.manager.sendAction(ACTION.WAVE, {});
  }
}
