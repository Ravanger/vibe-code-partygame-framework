import { SET_OPTIONS } from "@partygame/shared";
import { z } from "zod";
import { DEFAULT_OPTIONS, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";
import { optionFields } from "../optionFields.js";

/** The room options as a form: one number field per numeric option of the schema, limits included. */
export class LobbySettingsViewModel {
  readonly fields = optionFields(z.toJSONSchema(WitClashOptionsSchema));
  private readonly drafts = $state<Record<string, string>>({});

  constructor(private readonly manager: WitClashManager) {}

  get canEdit(): boolean {
    return this.manager.isHost;
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
    const parsed = WitClashOptionsSchema.safeParse(this.parseOptions());
    return Object.fromEntries(Object.entries(parsed.success ? parsed.data : DEFAULT_OPTIONS));
  }

  private parseOptions(): unknown {
    try {
      return JSON.parse(this.manager.state?.options ?? "{}");
    } catch {
      return {};
    }
  }
}
