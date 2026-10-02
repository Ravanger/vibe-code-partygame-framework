<script lang="ts">
import { StatusPanel, Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import ScreenTitle from "../components/ScreenTitle.svelte";
import VoteBoard from "../components/VoteBoard.svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="tie-breaker">
  <div class="top">
    <ScreenTitle title="Tie-breaker!" />
    <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
  </div>

  <div class="question card taped">
    <h2>{vm.promptText}</h2>
  </div>

  {#if vm.canVote}
    <p class="how hand">Tap the funnier answer</p>
  {:else}
    <StatusPanel tone="wait" title="Sit tight while the others vote." />
  {/if}

  <VoteBoard choices={vm.choices} canVote={vm.canVote} onvote={(id) => vm.vote(id)} />

  <p class="turnout"><span class="chip chip--paper">{`${vm.votesCast} of ${vm.votesExpected} voted`}</span></p>
</div>

<style>
  .tie-breaker {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .question {
    --tilt: -1deg;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1.25;
  }

  :global(main.tv) h2 {
    font-size: calc(var(--fs-5) * var(--scale, 1));
  }

  .how {
    margin: 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  .turnout {
    margin: auto 0 0;
    text-align: center;
  }
</style>
