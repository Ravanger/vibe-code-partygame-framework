import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@partygame/shared";

const MAX_ATTEMPTS = 10;

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

  /** Binds a code to a room. Called by the server; game code should not. */
  register(code: string, roomId: string): void {
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

  resolve(code: string): string | undefined {
    return this.codeToRoomId.get(code);
  }

  resolveByRoomId(roomId: string): string | undefined {
    return this.roomIdToCode.get(roomId);
  }

  generateAndRegister(roomId: string): string {
    const code = this.generateCode();
    this.register(code, roomId);
    return code;
  }
}
