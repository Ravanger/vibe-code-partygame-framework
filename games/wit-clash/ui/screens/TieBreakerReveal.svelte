<script lang="ts">
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="reveal">
  <h1>Tie-breaker!</h1>
  {#if vm.revealed}
    <MatchupCard matchup={vm.revealed} />
    <p class="next">{`Next up in ${vm.secondsLeft}s`}</p>
  {:else}
    <div class="waiting">Revealing...</div>
  {/if}
</div>

<style>
  .reveal {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }

  .next,
  .waiting {
    margin: 0;
    color: #666;
  }
</style>
