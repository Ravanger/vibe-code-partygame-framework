import { type SchemaType, schema, t } from "@colyseus/schema";
import { actionFactory, defineGame } from "@partygame/core";
import { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";

const SecretSchema = schema({ word: t.string().default("") }, "SecretSchema");

export const BuzzerState = BaseGameState.extend(
  {
    winner: t.string().default(""),
    buzzCount: t.number().default(0),
    syncCount: t.number().default(0),
    lucky: t.number().default(0),
    secrets: t.map(SecretSchema).view(),
  },
  "BuzzerState",
);
export type BuzzerState = SchemaType<typeof BuzzerState>;

export interface BuzzerPrivate {
  buzzed: Set<string>;
}

export interface BuzzerOptions {
  buzzMs: number;
  explodeOnTimeout: boolean;
}

const action = actionFactory<BuzzerState, BuzzerPrivate, BuzzerOptions>();

export const BuzzerGame = defineGame<BuzzerState, BuzzerPrivate, BuzzerOptions>({
  name: "Buzzer",
  minPlayers: 2,
  maxPlayers: 3,
  startPhase: "Buzz",
  autoStart: true,
  options: z.object({
    buzzMs: z.number().default(10_000),
    explodeOnTimeout: z.boolean().default(false),
  }),
  createPrivateState: () => ({ buzzed: new Set() }),
  phases: {
    Buzz: {
      duration: (ctx) => ctx.options.buzzMs,
      onEnter: (ctx) => {
        ctx.activateWaitingPlayers();
        ctx.priv.buzzed.clear();
        ctx.state.winner = "";
        ctx.state.buzzCount = 0;
        ctx.state.lucky = Math.floor(ctx.rng() * 1000);
        for (const player of ctx.activePlayers()) {
          const secret = new SecretSchema();
          secret.word = `secret-${player.id}`;
          ctx.state.secrets.set(player.id, secret);
          ctx.showTo(player.id, secret);
        }
      },
      onTimeout: (ctx) => {
        if (ctx.options.explodeOnTimeout) throw new Error("timeout exploded");
        ctx.transition("Done");
      },
      onRosterChange: (ctx) => {
        const active = ctx.activePlayers();
        if (active.length > 0 && active.every((p) => ctx.priv.buzzed.has(p.id))) {
          ctx.transition("Done");
        }
      },
      actions: {
        BUZZ: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.priv.buzzed.add(ctx.playerId);
            ctx.state.buzzCount = ctx.priv.buzzed.size;
            if (!ctx.state.winner) {
              ctx.state.winner = ctx.playerId;
              ctx.broadcast("FIRST", { playerId: ctx.playerId });
            }
            if (ctx.activePlayers().every((p) => ctx.priv.buzzed.has(p.id))) ctx.transition("Done");
          },
        }),
        JUNK: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => ctx.send(ctx.playerId, "ERROR", "junk"),
        }),
        BOOM: action({
          from: "player",
          payload: z.object({}),
          handler: () => {
            throw new Error("boom");
          },
        }),
      },
    },
    Done: {
      actions: {
        RESET: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.returnToLobby(),
        }),
      },
    },
  },
  onPlayerSync: (ctx, playerId) => {
    ++ctx.state.syncCount;
    ctx.send(playerId, "SYNCED", { phase: ctx.phase });
  },
  onReturnToLobby: (ctx) => {
    for (const id of [...ctx.state.secrets.keys()]) {
      const secret = ctx.state.secrets.get(id);
      if (secret) ctx.hideFrom(id, secret);
    }
    ctx.state.secrets.clear();
  },
});

export const PlainGame = defineGame<BaseGameState, Record<string, never>, Record<string, unknown>>({
  name: "Plain",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  createPrivateState: () => ({}),
  phases: { Play: {} },
});
