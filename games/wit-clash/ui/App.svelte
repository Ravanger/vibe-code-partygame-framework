<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
// biome-ignore lint/correctness/noUnusedImports: used in template
import CategoryVote from "./screens/CategoryVote.svelte";
// biome-ignore lint/correctness/noUnusedImports: used in template
import WaitingRoom from "./screens/WaitingRoom.svelte";
// biome-ignore lint/correctness/noUnusedImports: used in template
import Welcome from "./screens/Welcome.svelte";
import { AppViewModel } from "./viewmodels/AppViewModel.svelte.js";

const { manager } = $props<{ manager: GameConnectionManager }>();
// biome-ignore lint/correctness/noUnusedVariables: used in template
const vm = new AppViewModel(manager);
</script>

<main>
  <header>
    <h1>WitClash</h1>
    <span class="badge {manager.connectionStatus}">{manager.connectionStatus}</span>
  </header>

  <section class="game-view">
    {#if vm.screen === 'welcome'}
      <Welcome {manager} />
    {:else if vm.screen === 'connecting'}
      <p class="connecting">Connecting to game server…</p>
    {:else if vm.screen === 'waiting-room'}
      <WaitingRoom {manager} />
    {:else if vm.screen === 'category-vote'}
      <CategoryVote {manager} />
    {:else}
      <p class="unsupported">This part of the game isn't built yet (phase: {vm.phase}).</p>
    {/if}
  </section>

  <footer><p>Player ID: {manager.room?.sessionId ?? 'N/A'}</p></footer>
</main>

<style>
  main { max-width: 800px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: white; }
  header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  h1 { margin: 0; font-size: 1.5rem; }
  .game-view { flex: 1; padding: 20px; }
  footer { padding: 10px 20px; border-top: 1px solid #eee; font-size: .8rem; color: #888; text-align: right; }
  .connecting, .unsupported { text-align: center; color: #666; padding: 40px; }
</style>
