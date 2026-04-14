import { describe, it, expect } from "vitest"
import { GameRoom } from "../src/rooms/GameRoom.js"
import { GameStateSchema } from "../src/schema/GameStateSchema.js"
import { defineGame, createPhase, createAction } from "@partygame/core"

describe("GameRoom Action Routing", () => {
  it("prevents players from performing host-only actions", async () => {
    const game = defineGame({
      name: "role-test",
      minPlayers: 1,
      maxPlayers: 2,
      phases: {
        lobby: phase({
          actions: {
            hostAction: action({
              from: "host",
              handler: () => {}
            })
          }
        })
      }
    })

    const room = new GameRoom()
    room.setDefinition(game)
    
    // Minimal mock for room setup
    // We want to test the Action routing, not the transport layer.
    // This is a unit-ish test of the GameRoom.
    
    // Manually trigger the message handler
    // ...
    expect(true).toBe(false) // Forcing failure for TDD
  })
})
