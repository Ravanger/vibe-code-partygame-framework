<script lang="ts">
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";
import { GameControlsViewModel } from "../viewmodels/GameControlsViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new GameControlsViewModel(manager));
</script>

{#if vm.isVisible}
  <div class="game-controls">
    {#if vm.canEndGame}
      {#if vm.confirmingEnd}
        <span class="confirm">End the game for everyone?</span>
        <button type="button" class="yes" onclick={() => vm.confirmEnd()}>Yes</button>
        <button type="button" onclick={() => vm.cancelEnd()}>No</button>
      {:else}
        <button type="button" onclick={() => vm.askEnd()}>End game</button>
      {/if}
    {/if}
    <button type="button" onclick={() => vm.leave()}>Leave game</button>
  </div>
{/if}

<style>
  .game-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    background: #e0e0e0;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .yes {
    background: #b91c1c;
    color: white;
  }

  .confirm {
    font-size: 0.85rem;
    color: #b91c1c;
  }
</style>
