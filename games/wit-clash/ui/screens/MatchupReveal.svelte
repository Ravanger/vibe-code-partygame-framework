<script lang="ts">
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import NextUpBar from "../components/NextUpBar.svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import type { WitClashManager } from "../manager.js";
import { MatchupRevealViewModel } from "../viewmodels/MatchupRevealViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new MatchupRevealViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="reveal-screen">
  {#if vm.matchup}
    <p class="count"><span class="chip chip--paper">{`Matchup ${vm.matchupNumber} of ${vm.totalMatchups}`}</span></p>
    <MatchupCard matchup={vm.matchup} myVoteId={vm.myVoteId} flip />
    <NextUpBar seconds={vm.secondsLeft} total={vm.totalSeconds} />
  {:else}
    <StatusPanel tone="wait" title="Revealing..." />
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
