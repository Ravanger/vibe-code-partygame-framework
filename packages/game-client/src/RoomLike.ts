/** The part of a Colyseus client `Room` the manager uses. `StubRoom` implements it for tests. */
export interface RoomLike<TState> {
  readonly roomId: string;
  readonly reconnectionToken: string;
  readonly state: TState;
  readonly onStateChange: ((callback: (state: TState) => void) => unknown) & {
    remove(callback: (state: TState) => void): void;
  };
  readonly onDrop: (callback: () => void) => unknown;
  readonly onReconnect: (callback: () => void) => unknown;
  readonly onLeave: (callback: () => void) => unknown;
  onMessage(type: string, callback: (payload: unknown) => void): () => void;
  send(type: string, payload?: unknown): void;
  request(type: string, payload?: unknown): Promise<unknown>;
  leave(consented?: boolean): Promise<number>;
}
