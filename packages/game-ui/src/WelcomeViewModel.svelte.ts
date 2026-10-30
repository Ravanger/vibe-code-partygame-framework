import { defaultClientStrings, type GameConnectionManager } from "@partygame/game-client";
import { CLIENT_MESSAGES, RoomCodeSchema, sanitizeRoomCode } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { errorText, getStrings } from "./strings.js";

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
      this.localError = this.invalidCodeText();
      return;
    }
    await this.attempt(() => this.manager.join(this.code));
  }

  async watch(): Promise<void> {
    this.localError = undefined;
    if (!this.codeIsValid) {
      this.localError = this.invalidCodeText();
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

  /** The table's room-code text, the English default when the table has none. */
  private invalidCodeText(): string {
    return getStrings().clientStrings.invalidRoomCode ?? defaultClientStrings.invalidRoomCode;
  }

  private async attempt(connect: () => Promise<void>): Promise<void> {
    this.manager.dismissError();
    try {
      await connect();
    } catch {
      const error = this.manager.lastServerError;
      this.localError = error
        ? errorText(error.code, error.message)
        : CLIENT_MESSAGES.CONNECTION_LOST;
      this.manager.dismissError();
    }
  }
}
