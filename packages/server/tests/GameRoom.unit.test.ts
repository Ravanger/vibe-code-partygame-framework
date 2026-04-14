import { vi, describe, it, expect } from "vitest"
import { GameRoom } from "../src/rooms/GameRoom.js"
import { PlayerSchema } from "../src/schema/PlayerSchema.js"
import { defineGame, createPhase, createAction } from "@partygame/core"

describe("GameRoom Unit Action Routing", () => {
  const game = defineGame({
      name: "role-test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
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
    room.onCreate()
    
    // @ts-ignore
    room.machine.send = vi.fn()
    
    const player = new PlayerSchema()
    player.role = "player"
    room.state.players.set("player-id", player)
    
    const host = new PlayerSchema()
    host.role = "host"
    room.state.players.set("host-id", host)
    
    const client = { sessionId: "player-id" }
    // @ts-ignore
    room.onMessage("ACTION", client, { name: "hostAction", data: {} })
    
    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled()
  })

  it.skip("allows players to perform player-only actions", () => {
    const room = new GameRoom()
    room.setDefinition(game)
    room.onCreate()
    
    // @ts-ignore
    room.machine.send = vi.fn()
    
    const player = new PlayerSchema()
    player.role = "player"
    room.state.players.set("player-id", player)
    
    const client = { sessionId: "player-id" }
    // @ts-ignore
    room.onMessage("ACTION", client, { name: "playerAction", data: {} })
    
    // @ts-ignore
    expect(room.machine.send).toHaveBeenCalled()
  })
})
