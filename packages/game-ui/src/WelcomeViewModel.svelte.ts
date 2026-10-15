import type { GameConnectionManager } from "@partygame/game-client";
import {
  CLIENT_MESSAGES,
  ROOM_CODE_LENGTH,
  RoomCodeSchema,
  sanitizeRoomCode,
} from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

const CODE_INVALID = `Game code must be ${ROOM_CODE_LENGTH} letters (A-Z)`;

export class WelcomeViewModel<TState extends BaseGameState> {
  code = $state("");
  localError = $state<string | undefined>(undefined);
  private autoJoined = false;

  constructor(
    private readonly manager: GameConnectionManager<TState>,
    private readonly urlCode?: string,
    private readonly urlTvCode?: string,
  ) {}

  get busy(): boolean {
    return this.manager.status === "connecting";
  }

  get codeIsValid(): boolean {
    return RoomCodeSchema.safeParse(this.code).success;
  }

  setCode(raw: string): void {
    this.code = sanitizeRoomCode(raw);
  }

  async host(): Promise<void> {
    this.localError = undefined;
    await this.attempt(() => this.manager.create());
  }

  async join(): Promise<void> {
    this.localError = undefined;
    if (!this.codeIsValid) {
      this.localError = CODE_INVALID;
      return;
    }
    await this.attempt(() => this.manager.join(this.code));
  }

  async watch(): Promise<void> {
    this.localError = undefined;
    if (!this.codeIsValid) {
      this.localError = CODE_INVALID;
      return;
    }
    await this.attempt(() => this.manager.joinAsSpectator(this.code));
  }

  /** Joins from a `?code=` share link, or watches from a `?tv=` link, once. */
  async autoJoinIfRequested(): Promise<void> {
    const code = this.urlTvCode ?? this.urlCode;
    if (this.autoJoined || !code) return;
    this.autoJoined = true;
    this.code = code;
    await (this.urlTvCode ? this.watch() : this.join());
  }

  dismissError(): void {
    this.localError = undefined;
  }

  private async attempt(connect: () => Promise<void>): Promise<void> {
    this.manager.dismissError();
    try {
      await connect();
    } catch {
      this.localError = this.manager.lastServerError?.message ?? CLIENT_MESSAGES.CONNECTION_LOST;
      this.manager.dismissError();
    }
  }
}
