<script lang="ts">
import { untrack } from "svelte";
import GameControls from "./components/GameControls.svelte";
import type { WitClashManager } from "./manager.js";
import { PHASE_SCREENS } from "./screens/index.js";
import JoinNextRound from "./screens/JoinNextRound.svelte";
import Welcome from "./screens/Welcome.svelte";
import { AppViewModel } from "./viewmodels/AppViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new AppViewModel(manager));
const route = $derived(vm.screen);
</script>

<main class:tv={vm.isSpectator}>
  <header>
    <h1>WitClash</h1>
    {#if vm.roomCode}
      <span class="room-chip">{vm.roomCode}</span>
    {/if}
    {#if vm.isReconnecting}
      <span class="reconnecting" role="status">reconnecting&hellip;</span>
    {/if}
    <GameControls {manager} />
  </header>

  {#if vm.error}
    <div class="toast" role="alert">
      <span>{vm.error.message}</span>
      <button type="button" onclick={() => vm.dismissError()} aria-label="Dismiss">&times;</button>
    </div>
  {/if}

  <section class="game-view">
    {#if route.kind === 'welcome'}
      <Welcome {manager} />
    {:else if route.kind === 'join-next-round'}
      <JoinNextRound {manager} />
    {:else if route.kind === 'phase'}
      {@const Screen = PHASE_SCREENS[route.phase].component}
      <Screen {manager} />
    {:else}
      <p class="connecting">Connecting to game server&hellip;</p>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: white;
  }

  main.tv {
    max-width: 1600px;
  }

  header {
    padding: 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    flex: 1;
  }

  .room-chip {
    font-family: monospace;
    letter-spacing: 3px;
    background: #f0f0f0;
    padding: 4px 10px;
    border-radius: 8px;
  }

  .reconnecting {
    font-size: 0.8rem;
    color: #f57c00;
  }

  .toast {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 12px 20px 0;
    padding: 10px 16px;
    border-radius: 8px;
    background: #fee2e2;
    color: #b91c1c;
  }

  .toast button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.3rem;
    cursor: pointer;
  }

  .game-view {
    flex: 1;
    padding: 20px;
  }

  .connecting {
    text-align: center;
    color: #666;
    padding: 40px;
  }
</style>
