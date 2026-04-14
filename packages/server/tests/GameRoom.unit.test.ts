import { vi } from "vitest"

vi.mock("../schema/GameStateSchema.js", () => ({
    GameStateSchema: class {}
}))

import { describe, it, expect } from "vitest"
import { GameRoom } from "../src/rooms/GameRoom.js"
import { defineGame, createPhase, createAction } from "@partygame/core"

describe("GameRoom Unit Action Routing", () => {
  const game = defineGame({
      name: "role-test",
      minPlayers: 1,
      maxPlayers: 2,
      phases: {
        lobby: createPhase({
          actions: {
            hostAction: createAction({
              from: "host",
              handler: vi.fn()
            }),
            playerAction: createAction({
              from: "player",
              handler: vi.fn()
            })
          }
        })
      }
    })

  it("enforces role-based action routing", () => {
    const room = new GameRoom()
    room.setDefinition(game)
    // @ts-ignore
    room.state = { 
        phase: "lobby", 
        players: new Map([
            ["player-id", { role: "player" }],
            ["host-id", { role: "host" }]
        ])
    }
    
    // @ts-ignore
    room.machine = { send: vi.fn() }
    
    // Test: Player attempting hostAction (should fail)
    const client = { sessionId: "player-id" }
    // @ts-ignore
    room.onMessage("ACTION", client, { name: "hostAction", data: {} })
    
    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled()
  })

  it("allows players to perform player-only actions", () => {
    const room = new GameRoom()
    room.setDefinition(game)
    // @ts-ignore
    room.state = { 
        phase: "lobby", 
        players: new Map([
            ["player-id", { role: "player" }],
        ])
    }
    
    // @ts-ignore
    room.machine = { send: vi.fn() }
    
    const client = { sessionId: "player-id" }
    // @ts-ignore
    room.onMessage("ACTION", client, { name: "playerAction", data: {} })
    
    // @ts-ignore
    expect(room.machine.send).toHaveBeenCalled()
  })
})
