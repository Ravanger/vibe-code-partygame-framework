import type { GameConnectionManager } from "@partygame/game-client";
import { RoomCodeSchema } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

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
    this.code = raw
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
  }

  async host(): Promise<void> {
    this.localError = undefined;
    await this.attempt(() => this.manager.create());
  }

  async join(): Promise<void> {
    this.localError = undefined;
    await this.attempt(() => this.manager.join(this.code));
  }

  async watch(): Promise<void> {
    this.localError = undefined;
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
    try {
      await connect();
    } catch (error) {
      this.localError = error instanceof Error ? error.message : String(error);
    }
  }
}
