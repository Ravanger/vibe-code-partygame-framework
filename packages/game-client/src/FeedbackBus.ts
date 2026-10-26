/** A phase transition observed on the connected room. */
export interface PhaseFeedbackEvent {
  type: "phase";
  from: string;
  to: string;
  reducedMotion: boolean;
}

/** The current phase's countdown entered its last ten seconds (once per phase). */
export interface UrgentFeedbackEvent {
  type: "urgent";
  reducedMotion: boolean;
}

/** A server broadcast for a name the game registered with `onMessage`. */
export interface MessageFeedbackEvent {
  type: "message";
  name: string;
  payload: unknown;
  reducedMotion: boolean;
}

export type FeedbackEvent = PhaseFeedbackEvent | UrgentFeedbackEvent | MessageFeedbackEvent;

/**
 * Typed event stream for sound and animation feedback. The manager feeds it from the room's
 * state (phase changes, countdown urgency) and from server broadcasts registered through
 * `onMessage`; every event carries a live `reducedMotion` flag so a game can choose quiet or
 * subtle feedback. The framework ships no audio or assets — games attach their own.
 */
export class FeedbackBus {
  private readonly listeners = new Map<
    FeedbackEvent["type"],
    Set<(event: FeedbackEvent) => void>
  >();

  constructor(private readonly isReducedMotion: () => boolean) {}

  /** Subscribes to one kind of event; returns an unsubscribe. */
  on<K extends FeedbackEvent["type"]>(
    type: K,
    callback: (event: Extract<FeedbackEvent, { type: K }>) => void,
  ): () => void {
    let callbacks = this.listeners.get(type);
    if (callbacks === undefined) {
      callbacks = new Set();
      this.listeners.set(type, callbacks);
    }
    const wrapped = callback as (event: FeedbackEvent) => void;
    callbacks.add(wrapped);
    return () => {
      callbacks.delete(wrapped);
    };
  }

  /** Feeds a phase transition. Called by the manager, not by games. */
  emitPhase(from: string, to: string): void {
    this.emit("phase", (reducedMotion) => ({ type: "phase", from, to, reducedMotion }));
  }

  /** Feeds the once-per-phase urgency event. Called by the manager, not by games. */
  emitUrgent(): void {
    this.emit("urgent", (reducedMotion) => ({ type: "urgent", reducedMotion }));
  }

  /** Feeds a server broadcast for a registered name. Called by the manager, not by games. */
  emitMessage(name: string, payload: unknown): void {
    this.emit("message", (reducedMotion) => ({ type: "message", name, payload, reducedMotion }));
  }

  // The preference is read only when a subscriber exists, so relaying an event nobody listens
  // for never touches the browser.
  private emit(
    type: FeedbackEvent["type"],
    build: (reducedMotion: boolean) => FeedbackEvent,
  ): void {
    const callbacks = this.listeners.get(type);
    if (callbacks === undefined) return;
    const event = build(this.isReducedMotion());
    for (const callback of [...callbacks]) callback(event);
  }
}
