<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { MatchupVoteViewModel } from "../viewmodels/MatchupVoteViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

// svelte-ignore state_referenced_locally -- manager is a stable long-lived instance, never reassigned by the parent
const vm = new MatchupVoteViewModel(manager);

$effect(() => {
  return () => vm.destroy();
});
</script>

<div class="matchup-vote">
  {#if vm.answers.length === 0}
    <div class="waiting">Waiting for matchup...</div>
  {:else if vm.isRevealed}
    <div class="reveal">
      <h2>{vm.promptText}</h2>
      <div class="answers">
        {#each vm.answers as answer}
          <div class="answer-card revealed" class:winner={answer.votes === Math.max(...vm.answers.map((a) => a.votes)) && answer.votes > 0}>
            <p class="text">{answer.text}</p>
            <p class="author">by {answer.authorName}</p>
            <p class="votes">{answer.votes} vote{answer.votes !== 1 ? "s" : ""}</p>
          </div>
        {/each}
      </div>
      <p class="next">Next matchup coming up...</p>
    </div>
  {:else}
    <div class="vote">
      <div class="header">
        <span class="progress">Matchup {vm.matchupNumber} of {vm.totalMatchups}</span>
        <div class="timer" class:urgent={vm.isUrgent}>
          {vm.secondsLeft}s
        </div>
      </div>

      <h2 class="prompt">{vm.promptText}</h2>

      <div class="answers">
        {#each vm.answers as answer}
          <button
            class="answer-card"
            class:selected={vm.myVote === answer.id}
            disabled={vm.isAuthor}
            onclick={() => vm.vote(answer.id)}
            aria-pressed={vm.myVote === answer.id}
          >
            <p class="text">{answer.text}</p>
          </button>
        {/each}
      </div>

      <p class="footer">
        {vm.votedCount} of {vm.eligibleVoterCount} voted
      </p>
    </div>
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
    justify-content: center;
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
    0%, 100% {
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

  h2 {
    text-align: center;
    font-size: 1.8rem;
    color: #333;
    margin: 0;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    border: 3px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    min-height: 120px;
  }

  .answer-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border-color: #667eea;
  }

  .answer-card:active {
    transform: translateY(0);
  }

  .answer-card:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .answer-card.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .answer-card.revealed {
    cursor: default;
    background: #f9fafb;
  }

  .answer-card.revealed:hover {
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .answer-card.winner {
    border-color: #22c55e;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  }

  .text {
    font-size: 1.1rem;
    color: #333;
    text-align: center;
    margin: 0;
    line-height: 1.5;
    flex: 1;
  }

  .author {
    font-size: 0.9rem;
    color: #666;
    margin: 0;
    font-style: italic;
  }

  .votes {
    font-size: 1rem;
    font-weight: 600;
    color: #667eea;
    margin: 0;
  }

  .footer {
    text-align: center;
    font-size: 1rem;
    color: #666;
    margin: 0;
  }

  .next {
    text-align: center;
    font-size: 1.1rem;
    color: #666;
    margin: 0;
  }

  .reveal {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
</style>
