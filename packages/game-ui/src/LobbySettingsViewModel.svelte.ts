import type { GameConnectionManager } from "@partygame/game-client";
import { SET_OPTIONS } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";
import { type OptionField, OptionFields } from "./OptionFields.js";
import { OptionsReader } from "./OptionsReader.svelte.js";

/** What `LobbySettingsViewModel` needs to build the settings form from a room's options schema. */
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
  /** The published value of each key when its draft started; a draft older than a newer publish no longer shows. */
  private readonly baselines: Record<string, string> = {};
  /** Keys with a SET_OPTIONS in flight; their typed value keeps showing until the server answers. */
  private readonly inFlight = new Set<string>();
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

  /** True for the host, the only seat that may change options. */
  get canEdit(): boolean {
    return this.manager.isHost;
  }

  /** True when the settings panel should be expanded initially: for the host and spectators. */
  get startsOpen(): boolean {
    return this.canEdit || this.manager.isSpectator;
  }

  /** What the field shows: what the host is typing while it is current or its commit is in flight, else what the server published. */
  valueOf(key: string): string {
    const draft = this.drafts[key];
    if (draft !== undefined && !this.stale(key)) return draft;
    return this.publishedOf(key);
  }

  /** Stores what the host is typing for a field without sending it; `commit` sends it. */
  setDraft(key: string, raw: string): void {
    if (this.drafts[key] === undefined || this.stale(key)) {
      // No draft yet, or the published value moved on since this one started: start fresh from it.
      this.dropDraft(key);
      this.baselines[key] = this.publishedOf(key);
    }
    this.drafts[key] = raw;
  }

  /** Picks one of a choice field's options and sends it; once the server answers, the field shows what it published. */
  async choose(key: string, value: string): Promise<void> {
    this.setDraft(key, value);
    await this.commit(key);
  }

  /** Sends the typed value with the field's own JSON type. A number draft that is empty or not a number, a boolean draft that is neither "true" nor "false", or a choice that is not one of the field's options is dropped without sending; once the server answers (a rejection is also shown by the app's error toast), the field shows what it published. */
  async commit(key: string): Promise<void> {
    if (this.drafts[key] !== undefined && this.stale(key)) this.dropDraft(key);
    const raw = this.drafts[key];
    if (raw === undefined || !this.canEdit) return;
    const field = this.fields.find((candidate) => candidate.key === key);
    if (field === undefined) return;
    let value: boolean | number | string;
    if (field.kind === "number") {
      value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value)) {
        this.dropDraft(key);
        return;
      }
    } else if (field.kind === "boolean") {
      if (raw !== "true" && raw !== "false") {
        this.dropDraft(key);
        return;
      }
      value = raw === "true";
    } else if (field.kind === "select") {
      if (!field.choices.includes(raw)) {
        this.dropDraft(key);
        return;
      }
      value = raw;
    } else {
      value = raw;
    }
    this.inFlight.add(key);
    try {
      await this.manager.sendAction(SET_OPTIONS, { [key]: value });
    } finally {
      // Accepted or rejected, the local draft no longer decides what the field shows.
      this.inFlight.delete(key);
      this.dropDraft(key);
    }
  }

  /** The value the server currently publishes for `key`, as the field would show it. */
  private publishedOf(key: string): string {
    return String(this.reader.current[key] ?? "");
  }

  /** True when the published value of `key` changed since its draft started and no commit for it is in flight. */
  private stale(key: string): boolean {
    return !this.inFlight.has(key) && this.publishedOf(key) !== this.baselines[key];
  }

  /** Removes a key's draft and the baseline it was compared against. */
  private dropDraft(key: string): void {
    delete this.drafts[key];
    delete this.baselines[key];
  }
}
