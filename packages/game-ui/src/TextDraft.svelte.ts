import type { GameConnectionManager } from "@partygame/game-client";
import { ErrorCode } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

/** What `TextDraft` needs beyond the connection manager. */
export interface TextDraftConfig {
  /** The maximum length a draft may have. */
  maxLength: number;
  /** The current text-filter level; the moderation line is hidden while it is "off". */
  filterLevel: () => string;
  /** How many texts the server has rejected so far, or `undefined` while no state is synced. */
  rejectedCount: () => number | undefined;
  /** The singular noun the moderation line counts, pluralised by appending "s". */
  noun: string;
}

/**
 * Shared rules for a free-text answer field: one draft per key, the remaining-character count and
 * submit guard against a maximum length, the server's rejection reason, and a host-only
 * moderation line.
 */
export class TextDraft {
  private readonly drafts = $state<Record<string, string>>({});
  private readonly maxLength: number;
  private readonly filterLevel: () => string;
  private readonly rejectedCount: () => number | undefined;
  private readonly noun: string;

  constructor(
    private readonly manager: GameConnectionManager<BaseGameState>,
    config: TextDraftConfig,
  ) {
    this.maxLength = config.maxLength;
    this.filterLevel = config.filterLevel;
    this.rejectedCount = config.rejectedCount;
    this.noun = config.noun;
  }

  /** The draft text for `key`; empty when nothing has been typed. */
  draft(key: string): string {
    return this.drafts[key] ?? "";
  }

  /** Stores the draft text for `key`. */
  setDraft(key: string, value: string): void {
    this.drafts[key] = value;
  }

  /** How many characters `key`'s draft may still grow by before hitting the limit. */
  charsRemaining(key: string): number {
    return this.maxLength - this.draft(key).length;
  }

  /** True when `key`'s draft is non-blank and within the limit. */
  canSubmit(key: string): boolean {
    const text = this.draft(key);
    return text.trim().length > 0 && text.length <= this.maxLength;
  }

  /** The server's message for a CONTENT_REJECTED error, else "". */
  get rejectionReason(): string {
    const error = this.manager.lastServerError;
    return error?.code === ErrorCode.CONTENT_REJECTED ? error.message : "";
  }

  /** For the host: how many texts were rejected and at which filter level; "" for non-hosts, while filtering is off or before state is synced. */
  get moderationLine(): string {
    if (!this.manager.isHost) return "";
    const level = this.filterLevel();
    if (level === "off") return "";
    const count = this.rejectedCount();
    if (count === undefined) return "";
    return `${count} ${count === 1 ? this.noun : `${this.noun}s`} rejected, level ${level}`;
  }
}
