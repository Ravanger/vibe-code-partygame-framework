import type { GameConnectionManager } from "@partygame/game-client";
import { SET_OPTIONS } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";
import { type OptionField, OptionFields } from "./OptionFields.js";
import { OptionsReader } from "./OptionsReader.svelte.js";

export interface LobbySettingsConfig {
  /** The room's options schema; the same one passed to `defineGame`. */
  schema: z.ZodType;
  /** Shown while the server has published nothing valid; default `{}`. */
  defaults?: Readonly<Record<string, unknown>>;
  /** Overrides the generated label of a field. */
  labels?: Readonly<Record<string, string>>;
  /** Reports each option the form cannot render; the default is a console warning, once per key per instance. */
  onUnsupported?: (key: string, reason: string) => void;
}

/** The room options as a form: one field per bounded numeric, boolean, string-enum or string option of the schema. */
export class LobbySettingsViewModel<TState extends BaseGameState> {
  readonly fields: OptionField[];
  private readonly drafts = $state<Record<string, string>>({});
  private readonly reader: OptionsReader<Record<string, unknown>>;

  constructor(
    private readonly manager: GameConnectionManager<TState>,
    config: LobbySettingsConfig,
  ) {
    this.fields = new OptionFields(config.labels, config.onUnsupported).from(
      z.toJSONSchema(config.schema),
    );
    // The config's schema is untyped; the reader only ever reads it as a record of fields.
    this.reader = new OptionsReader(
      manager,
      config.schema as z.ZodType<Record<string, unknown>>,
      config.defaults,
    );
  }

  get canEdit(): boolean {
    return this.manager.isHost;
  }

  get startsOpen(): boolean {
    return this.canEdit || this.manager.isSpectator;
  }

  /** What the field shows: what the host is typing, else what the server published. */
  valueOf(key: string): string {
    return this.drafts[key] ?? String(this.reader.current[key] ?? "");
  }

  setDraft(key: string, raw: string): void {
    this.drafts[key] = raw;
  }

  /** Picks one of a choice field's options and sends it; a rejection puts the published value back. */
  async choose(key: string, value: string): Promise<void> {
    this.setDraft(key, value);
    await this.commit(key);
  }

  /** Sends the typed value with the field's own JSON type. A number draft that is empty or not a number, a boolean draft that is neither "true" nor "false", or a choice that is not one of the field's options is dropped without sending; a rejection (also shown by the app's error toast) puts the published value back. */
  async commit(key: string): Promise<void> {
    const raw = this.drafts[key];
    if (raw === undefined || !this.canEdit) return;
    const field = this.fields.find((candidate) => candidate.key === key);
    if (field === undefined) return;
    let value: boolean | number | string;
    if (field.kind === "number") {
      value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value)) {
        delete this.drafts[key];
        return;
      }
    } else if (field.kind === "boolean") {
      if (raw !== "true" && raw !== "false") {
        delete this.drafts[key];
        return;
      }
      value = raw === "true";
    } else if (field.kind === "select") {
      if (!field.choices.includes(raw)) {
        delete this.drafts[key];
        return;
      }
      value = raw;
    } else {
      value = raw;
    }
    const result = await this.manager.sendAction(SET_OPTIONS, { [key]: value });
    if (!result.ok) delete this.drafts[key];
  }
}
