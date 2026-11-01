<script lang="ts">
import { StatusPanel } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import NextUpBar from "../components/NextUpBar.svelte";
import type { WitClashManager } from "../manager.js";
import { MatchupRevealViewModel } from "../viewmodels/MatchupRevealViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new MatchupRevealViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="reveal-screen">
  {#if vm.matchup}
    <h2 class="count" tabindex="-1"><span class="chip chip--paper">{`Matchup ${vm.matchupNumber} of ${vm.totalMatchups}`}</span></h2>
    <MatchupCard matchup={vm.matchup} myVoteId={vm.myVoteId} flip />
    <NextUpBar seconds={vm.secondsLeft} total={vm.totalSeconds} />
  {:else}
    <StatusPanel tone="wait" title="Revealing..." heading />
  {/if}
</div>

<style>
  .reveal-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .count {
    margin: 0;
    text-align: center;
  }
</style>
