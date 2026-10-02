<script lang="ts">
import { untrack } from "svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import Timer from "../components/Timer.svelte";
import VoteBoard from "../components/VoteBoard.svelte";
import type { WitClashManager } from "../manager.js";
import { MatchupVoteViewModel } from "../viewmodels/MatchupVoteViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new MatchupVoteViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="matchup-vote">
  {#if vm.choices.length === 0}
    <StatusPanel tone="wait" title="Waiting for matchup..." />
  {:else}
    <div class="top">
      <span class="chip chip--paper">{`Matchup ${vm.matchupNumber} of ${vm.totalMatchups}`}</span>
      <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
    </div>

    <div class="question card taped">
      <h2>{vm.promptText}</h2>
    </div>

    {#if vm.isSpectator}
      <StatusPanel tone="info" title="Cast your votes on your phones." />
    {:else if vm.isOwnMatchup}
      <StatusPanel tone="wait" title="This one is yours. Sit tight while the others vote." />
    {:else if vm.isForfeit}
      <StatusPanel tone="info" title="Only one answer came in — no vote needed." />
    {:else if !vm.canVote}
      <StatusPanel tone="info" title="You cannot vote on this one." />
    {:else}
      <p class="how hand">Tap the funnier answer</p>
    {/if}

    <VoteBoard choices={vm.choices} canVote={vm.canVote} onvote={(id) => vm.vote(id)} />

    <p class="turnout"><span class="chip chip--paper">{`${vm.votesCast} of ${vm.votesExpected} voted`}</span></p>
  {/if}
</div>

<style>
  .matchup-vote {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
