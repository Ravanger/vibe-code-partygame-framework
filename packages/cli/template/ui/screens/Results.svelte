<script lang="ts">
import { ActionBar, StatusPanel } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { __PascalName__Manager } from "../manager.js";
import { ResultsViewModel } from "../viewmodels/ResultsViewModel.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new ResultsViewModel(manager));
</script>

<div class="results">
  <h1>{vm.headline}</h1>

  {#if vm.isHost}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => vm.playAgain()}>Play Again</button>
    </ActionBar>
  {:else if !manager.isSpectator}
    <StatusPanel tone="wait" title="Waiting for the host..." />
  {/if}
</div>

<style>
  .results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    padding-top: 2rem;
  }

  h1 {
    margin: 0;
    font-size: var(--fs-5);
  }
</style>
