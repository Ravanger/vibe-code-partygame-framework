<script lang="ts">
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="tie-breaker">
  <h1>Tie-breaker!</h1>
  <div class="timer" class:urgent={vm.isUrgent}>{`${vm.secondsLeft}s`}</div>
  <h2 class="prompt">{vm.promptText}</h2>

  {#if !vm.canVote}
    <p class="notice">Sit tight while the others vote.</p>
  {/if}

  <div class="answers">
    {#each vm.choices as choice (choice.id)}
      <button
        type="button"
        class="answer-card"
        class:selected={choice.isMine}
        disabled={!vm.canVote}
        aria-pressed={choice.isMine}
        onclick={() => vm.vote(choice.id)}
      >
        {choice.text}
      </button>
    {/each}
  </div>

  <p class="notice">{`${vm.votesCast} of ${vm.votesExpected} voted`}</p>
</div>

<style>
  .tie-breaker {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }

  .timer {
    font-size: 2.5rem;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .timer.urgent {
    color: #f57c00;
  }

  .prompt {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.4;
  }

  .answers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (max-width: 600px) {
    .answers {
      grid-template-columns: 1fr;
    }
  }

  .answer-card {
    padding: 24px 16px;
    min-height: 120px;
    border: 3px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .answer-card:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .answer-card.selected {
    border-color: #667eea;
    background: #ede9fe;
    opacity: 1;
  }

  .notice {
    margin: 0;
    color: #666;
    font-style: italic;
  }
</style>
