<script lang="ts">
import type { GameClient } from "@partygame/client";
const { client: _client } = $props<{ client: GameClient }>();
</script>

<div class="lobby">
  <h2>Lobby</h2>
  <div class="room-info">
    <p>Room: {client.state.roomCode}</p>
  </div>
  <button onclick={() => client.send('ACTION', { name: 'START_GAME', data: {} })}>
    Start Game
  </button>
</div>

<style>
  .lobby { padding: 20px; text-align: center; }
  button { padding: 10px 20px; font-size: 1.2rem; background: #4CAF50; color: white; border: none; cursor: pointer; }
</style>
