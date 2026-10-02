<script lang="ts">
import { StatusPanel } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import NextUpBar from "../components/NextUpBar.svelte";
import ScreenTitle from "../components/ScreenTitle.svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="reveal-screen">
  <ScreenTitle title="Tie-breaker!" />
  {#if vm.revealed}
    <MatchupCard matchup={vm.revealed} myVoteId={vm.myVoteId} flip />
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
</style>
