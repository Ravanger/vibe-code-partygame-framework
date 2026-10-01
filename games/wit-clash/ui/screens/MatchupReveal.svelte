<script lang="ts">
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import type { WitClashManager } from "../manager.js";
import { MatchupRevealViewModel } from "../viewmodels/MatchupRevealViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new MatchupRevealViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="reveal">
  {#if vm.matchup}
    <p class="progress">{`Matchup ${vm.matchupNumber} of ${vm.totalMatchups}`}</p>
    <MatchupCard matchup={vm.matchup} />
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
  }

  .progress,
  .next {
    text-align: center;
    color: #666;
    margin: 0;
  }

  .waiting {
    text-align: center;
    color: #666;
    padding: 40px;
    font-size: 1.2rem;
  }
</style>
