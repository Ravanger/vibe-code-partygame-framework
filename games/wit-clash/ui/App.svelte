<script lang="ts">
import type { GameConnectionManager } from "@partygame/client/src/connection.js";
import Lobby from "./Lobby.svelte";

const { manager } = $props<{ manager: GameConnectionManager }>();
const state = $derived(manager.room?.state ?? { phase: "lobby" });
</script>

<main>
  <header>
    <h1>WitClash</h1>
    <div class="status">
      Status: <span class="badge {manager.connectionStatus}">{manager.connectionStatus}</span>
    </div>
  </header>

  <section class="game-view">
    {#if state.phase === 'lobby'}
      <Lobby {manager} />
    {:else}
      <div class="unknown-phase">
        <p>Phase: {state.phase}</p>
        <p>Please wait for the game to advance...</p>
      </div>
    {/if}
  </section>

  <footer>
    <p>Player ID: {manager.room?.sessionId ?? 'N/A'}</p>
  </footer>
</main>

<style>
  :global(body) { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f5f5f5; color: #333; }
  main { max-width: 800px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
  header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  h1 { margin: 0; font-size: 1.5rem; color: #333; }
  .status { font-size: 0.9rem; }
  .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; }
  .badge.connected { background: #e8f5e9; color: #2e7d32; }
  .badge.disconnected { background: #ffebee; color: #c62828; }
  .badge.connecting { background: #fff8e1; color: #f9a825; }
  .game-view { flex: 1; padding: 20px; }
  footer { padding: 10px 20px; border-top: 1px solid #eee; font-size: 0.8rem; color: #888; text-align: right; }
  .unknown-phase { text-align: center; color: #666; padding: 40px; }
</style>
