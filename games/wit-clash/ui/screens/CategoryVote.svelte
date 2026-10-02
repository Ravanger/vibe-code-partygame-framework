<script lang="ts">
import { Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import ScreenTitle from "../components/ScreenTitle.svelte";
import type { WitClashManager } from "../manager.js";
import { CategoryVoteViewModel } from "../viewmodels/CategoryVoteViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new CategoryVoteViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="category-vote">
  <div class="top">
    <span class="chip chip--paper">{vm.roundLabel}</span>
    <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
  </div>

  <ScreenTitle title="Pick a category" hint="Tap the one you want to write about. Most votes wins." />

  <div class="cards">
    {#each vm.options as option (option.id)}
      <button
        type="button"
        class="pick card"
        class:selected={vm.myVote === option.id}
        disabled={vm.isSpectator}
        onclick={() => vm.vote(option.id)}
        aria-pressed={vm.myVote === option.id}
      >
        {#if vm.myVote === option.id}
          <span class="sticker stamp" aria-hidden="true">MY PICK</span>
        {/if}
        <span class="emoji">{option.emoji}</span>
        <span class="label">{option.name}</span>
        <span class="tally">
          <span class="pips" aria-hidden="true">
            {#each Array.from({ length: option.votes }) as _, pip (pip)}
              <i></i>
            {/each}
          </span>
          <span class="count">{`${option.votes} vote${option.votes !== 1 ? "s" : ""}`}</span>
        </span>
      </button>
    {/each}
  </div>

  <p class="turnout"><span class="chip chip--paper">{`${vm.votesCast} of ${vm.votesExpected} voted`}</span></p>
</div>

<style>
  .category-vote {
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

  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .pick {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.5rem;
    max-height: 7.5rem;
    padding: 0.6rem 1rem;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .pick:disabled {
    color: var(--ink);
    cursor: default;
  }

  .pick.selected {
    background: var(--sun);
  }

  .stamp {
    position: absolute;
    top: -1rem;
    right: -0.3rem;
    font-size: var(--fs-2);
  }

  .emoji {
    font-size: calc(var(--fs-6) * var(--scale, 1));
    line-height: 1;
  }

  .label {
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .tally {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
    font-size: calc(var(--fs-1) * var(--scale, 1));
  }

  .pips {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 3px;
    max-width: 6rem;
  }

  .pips i {
    width: 12px;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--pink);
  }

  .turnout {
    margin: auto 0 0;
    text-align: center;
  }

  @keyframes stamp-pop {
    0% {
      transform: scale(0.94);
    }
    60% {
      transform: scale(1.04);
    }
    100% {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .pick.selected {
      animation: stamp-pop 0.25s ease-out;
    }
  }

  :global(main.tv) .cards {
    flex-direction: row;
    align-items: stretch;
    gap: 2rem;
  }

  :global(main.tv) .pick {
    flex: 1;
    grid-template-columns: 1fr;
    justify-items: center;
    max-height: none;
    padding: 2rem 1rem;
    text-align: center;
  }

  :global(main.tv) .tally {
    align-items: center;
  }

  :global(main.tv) .emoji {
    font-size: 6rem;
  }
</style>
