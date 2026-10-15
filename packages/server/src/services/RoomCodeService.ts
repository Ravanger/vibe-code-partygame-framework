import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@partygame/shared";

const MAX_ATTEMPTS = 10;

export class RoomCodeService {
  private codeToRoomId: Map<string, string> = new Map();
  private roomIdToCode: Map<string, string> = new Map();

  generateCode(): string {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; ++attempt) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; ++i) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      }
      if (!this.codeToRoomId.has(code)) return code;
    }
    throw new Error("Failed to generate unique room code after maximum attempts");
  }

  register(code: string, roomId: string): void {
    this.codeToRoomId.set(code, roomId);
    this.roomIdToCode.set(roomId, code);
  }

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
