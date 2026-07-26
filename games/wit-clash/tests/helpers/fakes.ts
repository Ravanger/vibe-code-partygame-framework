import { vi } from "vitest";

export interface FakePlayer {
  id: string;
  playerId: string;
  name: string;
  role: string;
  isReady: boolean;
  isConnected: boolean;
}

export interface FakeRoom {
  roomId: string;
  sessionId: string;
  reconnectionToken: string;
  state: FakeState;
  send: (type: string, payload?: unknown) => void;
  leave: (consented: boolean) => void;
  onStateChange: (cb: (state: FakeState) => void) => void;
  onLeave: (cb: () => void) => void;
  onMessage: (type: string, cb: (payload: unknown) => void) => void;
  // Test-only: drive an incoming server message
  __emit?: (type: string, payload: unknown) => void;
}

export interface FakeState {
  phase: string;
  roomCode: string;
  serverNow: number;
  phaseEndsAt: number;
  players: Map<string, FakePlayer>;
  categoryOptions: Array<{ id: string; name: string; emoji: string; votes: number }>;
  categoryVotes: Map<string, string>;
  matchups: unknown[];
  answerVotes: Map<string, string>;
  activeMatchupIndex: number;
  isRevealing: boolean;
  roundNumber: number;
  totalRounds: number;
  answersSubmitted: number;
  answersExpected: number;
  scoreboard: unknown[];
  isFinalRound: boolean;
}

export interface FakeManager {
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  error: string | undefined;
  stateVersion: number;
  room: FakeRoom | undefined;
  create: (roomName?: string) => Promise<FakeRoom>;
  join: (code: string) => Promise<FakeRoom>;
  joinByCode: (code: string) => Promise<FakeRoom>;
  connect: () => Promise<FakeRoom>;
  tryReconnect: () => Promise<boolean>;
  reset: () => void;
}

/** Mirrors GameStateSchema. Maps are real Maps so .get/.values/.size behave. */
export function makeFakeState(over: Partial<FakeState> = {}): FakeState {
  return {
    phase: "Lobby",
    roomCode: "PNVW",
    serverNow: 0,
    phaseEndsAt: 0,
    players: new Map(),
    categoryOptions: [],
    categoryVotes: new Map(),
    matchups: [],
    answerVotes: new Map(),
    activeMatchupIndex: -1,
    isRevealing: false,
    roundNumber: 0,
    totalRounds: 3,
    answersSubmitted: 0,
    answersExpected: 0,
    scoreboard: [],
    isFinalRound: false,
    ...over,
  };
}

export function makePlayer(over: Partial<FakePlayer> = {}): FakePlayer {
  return {
    id: "me",
    playerId: "uuid-me",
    name: "Me",
    role: "player",
    isReady: true,
    isConnected: true,
    ...over,
  };
}

export function makeFakeRoom(over: Partial<FakeRoom> = {}): FakeRoom {
  const handlers = new Map<string, (payload: unknown) => void>();
  const room: FakeRoom = {
    roomId: "room-1",
    sessionId: "me",
    reconnectionToken: "room-1:tok",
    state: makeFakeState(),
    send: vi.fn(),
    leave: vi.fn(),
    onStateChange: vi.fn(),
    onLeave: vi.fn(),
    onMessage: vi.fn((type: string, cb: (p: unknown) => void) => {
      handlers.set(type, cb);
    }),
    // Test-only: drive an incoming server message
    __emit: (type: string, payload: unknown) => handlers.get(type)?.(payload),
    ...over,
  };
  return room;
}

/** Stand-in for GameConnectionManager. Plain object, not reactive. */
export function fakeManager(over: Partial<FakeManager> = {}): FakeManager {
  return {
    connectionStatus: "disconnected" as const,
    error: undefined as string | undefined,
    stateVersion: 0,
    room: undefined as FakeRoom | undefined,
    create: vi.fn().mockResolvedValue(makeFakeRoom()),
    join: vi.fn().mockResolvedValue(makeFakeRoom()),
    joinByCode: vi.fn().mockResolvedValue(makeFakeRoom()),
    connect: vi.fn().mockResolvedValue(makeFakeRoom()),
    tryReconnect: vi.fn().mockResolvedValue(false),
    reset: vi.fn(),
    ...over,
  };
}

/** Connected manager with N ready players — the common case. */
export function connectedManager(players: FakePlayer[], stateOver = {}): FakeManager {
  const state = makeFakeState({
    players: new Map(players.map((p) => [p.id, p])),
    ...stateOver,
  });
  return fakeManager({
    connectionStatus: "connected",
    room: makeFakeRoom({ state }),
  });
}

/**
 * Connected manager whose ROOM STATE carries the given fields.
 * Use this whenever a test needs to set a state field such as phaseEndsAt,
 * categoryOptions, matchups or scoreboard.
 */
export function managerWithState(stateOver: Partial<FakeState>): FakeManager {
  return fakeManager({
    connectionStatus: "connected",
    room: makeFakeRoom({ state: makeFakeState(stateOver) }),
  });
}
