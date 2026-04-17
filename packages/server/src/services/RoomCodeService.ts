const CODE_LENGTH = 4;
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class RoomCodeService {
  private codeToRoomId: Map<string, string> = new Map();
  private roomIdToCode: Map<string, string> = new Map();

  generateCode(): string {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * CHARSET.length);
        code += CHARSET[randomIndex];
      }
      attempts++;
    } while (this.codeToRoomId.has(code) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique room code after maximum attempts");
    }

    return code;
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
