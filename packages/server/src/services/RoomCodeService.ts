import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@partygame/shared";

const MAX_ATTEMPTS = 10;

/** Maps short human-typed room codes to Colyseus room ids and back. */
export class RoomCodeService {
  private codeToRoomId: Map<string, string> = new Map();
  private roomIdToCode: Map<string, string> = new Map();
  private readonly randomIndex: (max: number) => number;

  /**
   * @param randomIndex uniform index in `[0, max)` for each code letter; defaults to
   * `crypto.randomInt` from `node:crypto` (unbiased CSPRNG).
   */
  constructor(randomIndex: (max: number) => number = (max) => randomInt(0, max)) {
    this.randomIndex = randomIndex;
  }

  /** Returns an unused random code without registering it; throws after repeated collisions. */
  generateCode(): string {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; ++attempt) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; ++i) {
        code += ROOM_CODE_ALPHABET[this.randomIndex(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.codeToRoomId.has(code)) return code;
    }
    throw new Error(
      `Could not generate a unique room code after ${MAX_ATTEMPTS} attempts; too many open rooms`,
    );
  }

  /**
   * Binds a code to a room. Refuses to rebind: a code already bound to another room, or a room
   * that already has a different code, throws instead of silently orphaning the old entry; the
   * identical pair is accepted as a no-op. Called by the server; game code should not.
   */
  register(code: string, roomId: string): void {
    const boundRoom = this.codeToRoomId.get(code);
    if (boundRoom !== undefined && boundRoom !== roomId) {
      throw new Error(
        `register: room code ${code} is already bound to room ${boundRoom}, not ${roomId}`,
      );
    }
    const boundCode = this.roomIdToCode.get(roomId);
    if (boundCode !== undefined && boundCode !== code) {
      throw new Error(
        `register: room ${roomId} is already bound to room code ${boundCode}, not ${code}`,
      );
    }
    this.codeToRoomId.set(code, roomId);
    this.roomIdToCode.set(roomId, code);
  }

  /** Releases a code so it can be reused. Called by the server; game code should not. */
  unregister(code: string): void {
    const roomId = this.codeToRoomId.get(code);
    if (roomId) {
      this.roomIdToCode.delete(roomId);
    }
    this.codeToRoomId.delete(code);
  }

  /** The number of rooms currently registered. */
  get size(): number {
    return this.codeToRoomId.size;
  }

  /** The room id bound to `code`, or `undefined` when none is. */
  resolve(code: string): string | undefined {
    return this.codeToRoomId.get(code);
  }

  /** The code bound to `roomId`, or `undefined` when none is. */
  resolveByRoomId(roomId: string): string | undefined {
    return this.roomIdToCode.get(roomId);
  }

  /** Generates an unused code and binds it to `roomId`. Called by the server; game code should not. */
  generateAndRegister(roomId: string): string {
    const code = this.generateCode();
    this.register(code, roomId);
    return code;
  }
}
