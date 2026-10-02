import type { GameConnectionManager } from "@partygame/game-client";
import { SET_OPTIONS } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";
import { type OptionField, OptionFields } from "./OptionFields.js";

export interface LobbySettingsConfig {
  /** The room's options schema; the same one passed to `defineGame`. */
  schema: z.ZodType;
  /** Shown while the server has published nothing valid; default `{}`. */
  defaults?: Readonly<Record<string, unknown>>;
  /** Overrides the generated label of a field. */
  labels?: Readonly<Record<string, string>>;
}

/** The room options as a form: one number field per bounded numeric option of the schema. */
export class LobbySettingsViewModel<TState extends BaseGameState> {
  readonly fields: OptionField[];
  private readonly drafts = $state<Record<string, string>>({});

  constructor(
    private readonly manager: GameConnectionManager<TState>,
    private readonly config: LobbySettingsConfig,
  ) {
    this.fields = new OptionFields(config.labels).from(z.toJSONSchema(config.schema));
  }

  get canEdit(): boolean {
    return this.manager.isHost;
  }

  get startsOpen(): boolean {
    return this.canEdit || this.manager.isSpectator;
  }

  /** What the field shows: what the host is typing, else what the server published. */
  valueOf(key: string): string {
    return this.drafts[key] ?? String(this.published()[key] ?? "");
  }

  setDraft(key: string, raw: string): void {
    this.drafts[key] = raw;
  }

  /** Sends the typed value; a rejection (also shown by the app's error toast) puts the published value back. */
  async commit(key: string): Promise<void> {
    const raw = this.drafts[key];
    if (raw === undefined || !this.canEdit) return;
    const result = await this.manager.sendAction(SET_OPTIONS, { [key]: Number(raw) });
    if (!result.ok) delete this.drafts[key];
  }

  private published(): Record<string, unknown> {
    const parsed = this.config.schema.safeParse(this.parseOptions());
    const source =
      parsed.success && this.isRecord(parsed.data) ? parsed.data : this.config.defaults;
    return Object.fromEntries(Object.entries(source ?? {}));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private parseOptions(): unknown {
    try {
      return JSON.parse(this.manager.state?.options ?? "{}");
    } catch {
      return {};
    }
  }
}
