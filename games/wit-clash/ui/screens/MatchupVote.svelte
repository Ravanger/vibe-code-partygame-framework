<script lang="ts">
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";
import { MatchupVoteViewModel } from "../viewmodels/MatchupVoteViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new MatchupVoteViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="matchup-vote">
  {#if vm.choices.length === 0}
    <div class="waiting">Waiting for matchup...</div>
  {:else}
    <div class="header">
      <span class="progress">{`Matchup ${vm.matchupNumber} of ${vm.totalMatchups}`}</span>
      <div class="timer" class:urgent={vm.isUrgent}>{`${vm.secondsLeft}s`}</div>
    </div>

    <h2 class="prompt">{vm.promptText}</h2>

    {#if vm.isSpectator}
      <p class="notice">Cast your votes on your phones.</p>
    {:else if vm.isOwnMatchup}
      <p class="notice">This one is yours. Sit tight while the others vote.</p>
    {:else if vm.isForfeit}
      <p class="notice">Only one answer came in — no vote needed.</p>
    {:else if !vm.canVote}
      <p class="notice">You cannot vote on this one.</p>
    {/if}

    <div class="answers">
      {#each vm.choices as choice (choice.id)}
        <button type="button"
          class="answer-card"
          class:selected={choice.isMine}
          disabled={!vm.canVote}
          onclick={() => vm.vote(choice.id)}
          aria-pressed={choice.isMine}
        >
          <p class="text">{choice.text}</p>
        </button>
      {/each}
    </div>

    <p class="footer">{`${vm.votesCast} of ${vm.votesExpected} voted`}</p>
  {/if}
</div>

<style>
  .matchup-vote {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .waiting {
    text-align: center;
    color: #666;
    padding: 40px;
    font-size: 1.2rem;
  }

  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #666;
  }

  .timer {
    font-size: 3rem;
    font-weight: bold;
    color: #333;
    font-variant-numeric: tabular-nums;
  }

  .timer.urgent {
    color: #f57c00;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .prompt {
    text-align: center;
    font-size: 1.8rem;
    color: #333;
    margin: 0;
    line-height: 1.4;
  }

  .notice {
    text-align: center;
    margin: 0;
    color: #666;
    font-style: italic;
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
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    border: 3px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    min-height: 120px;
  }

  .answer-card:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border-color: #667eea;
  }

  .answer-card:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .answer-card:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .answer-card.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
    opacity: 1;
  }

  .text {
    font-size: 1.1rem;
    color: #333;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .footer {
    text-align: center;
    font-size: 1rem;
    color: #666;
    margin: 0;
  }
</style>
