<script lang="ts">
  import { StatusPanel, Timer } from "@partygame/game-ui/components";
  import { untrack } from "svelte";
  import type { WitClashManager } from "../manager.js";
  import { HonorVoteViewModel } from "../viewmodels/HonorVoteViewModel.js";

  const { manager }: { manager: WitClashManager } = $props();

  const vm = untrack(() => new HonorVoteViewModel(manager));

  $effect(() => () => vm.destroy());
</script>

<div class="honor-vote">
  {#if vm.choices.length === 0}
    <StatusPanel tone="wait" title="Waiting for the best answers..." />
  {:else}
    <div class="top">
      <span class="chip chip--paper">Honor vote</span>
      <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
    </div>

    <div class="question card taped">
      <h2>Who wrote the funniest answer?</h2>
    </div>

    {#if vm.isSpectator}
      <StatusPanel tone="info" title="Cast your votes on your phones." />
    {:else if !vm.canVote}
      <StatusPanel tone="wait" title="You are the only one up. Sit tight while the table votes." />
    {:else}
      <p class="how hand">Tap the funniest answer</p>
    {/if}

    <div class="cards">
      {#each vm.choices as choice (choice.id)}
        <button
          type="button"
          class="answer card"
          class:picked={choice.isMine}
          disabled={!vm.canVote}
          aria-pressed={choice.isMine}
          onclick={() => vm.vote(choice.id)}>
          {#if choice.isMine}
            <span class="sticker stamp" aria-hidden="true">VOTED!</span>
          {/if}
          <span class="who">{choice.name}</span>
          <span class="words">{choice.text}</span>
        </button>
      {/each}
    </div>

    <p class="turnout"><span class="chip chip--paper">{`${vm.votesCast} of ${vm.votesExpected} voted`}</span></p>
  {/if}
</div>

<style>
  .honor-vote {
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

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
  }

  .answer {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 6.5rem;
    padding: 1.25rem 1rem;
    font: inherit;
    text-align: center;
    cursor: pointer;
    --tilt: -1deg;
    transform: rotate(var(--tilt));
  }

  .answer:nth-of-type(even) {
    --tilt: 1deg;
  }

  .answer:disabled {
    color: var(--ink);
    cursor: default;
  }

  .answer.picked {
    background: var(--color-2);
  }

  .who {
    font-weight: 700;
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .words {
    color: var(--ink-soft);
    font-size: calc(var(--fs-2) * var(--scale, 1));
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .stamp {
    position: absolute;
    top: -1.1rem;
    right: -0.4rem;
    font-size: var(--fs-2);
  }

  .turnout {
    margin: auto 0 0;
    text-align: center;
  }

  @media (prefers-reduced-motion: no-preference) {
    .answer {
      transition: transform 0.12s;
    }

    .answer:hover:not(:disabled) {
      transform: rotate(var(--tilt)) translateY(-3px);
    }
  }

  :global(main.tv) .cards {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 1.5rem;
  }

  :global(main.tv) .answer {
    min-height: 20dvh;
  }

  :global(main.tv) .who {
    font-size: calc(var(--fs-4) * var(--scale, 1));
  }

  :global(main.tv) .words {
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }
</style>
