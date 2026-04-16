<script lang="ts">
import type { GameConnectionManager } from "@partygame/client/src/connection.js";
const gameCode = $state("");
let _error = $state("");

const { manager } = $props<{ manager: GameConnectionManager }>();

const _joinGame = async () => {
  if (!gameCode.trim()) {
    _error = "Please enter a valid game code.";
    return;
  }
  _error = "";
  try {
    await manager.connect("wit_clash", { code: gameCode });
  } catch (e) {
    _error = `Failed to join game: ${e}`;
  }
};
</script>

<div class="lobby">
  <h2>WitClash Lobby</h2>

  {#if manager.connectionStatus === 'disconnected'}
    <div class="join-form">
      <input type="text" bind:value={gameCode} placeholder="Enter game code" />
      <button onclick={async () => await _joinGame()}>Join Game</button>
      {#if _error}<p class="error">{_error}</p>{/if}
    </div>
  {:else}
    <p>Status: {manager.connectionStatus}</p>
  {/if}
</div>
<style>
  .lobby { padding: 20px; text-align: center; }
  .join-form { display: flex; flex-direction: column; gap: 10px; max-width: 300px; margin: 0 auto; }
  input { padding: 10px; font-size: 1rem; }
  button { padding: 10px; font-size: 1rem; background: #4CAF50; color: white; border: none; cursor: pointer; }
  .error { color: #c62828; }
</style>
