<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { ResultsViewModel } from "../viewmodels/ResultsViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

// svelte-ignore state_referenced_locally -- manager is a stable long-lived instance, never reassigned by the parent
// biome-ignore lint/correctness/noUnusedVariables: used in template
const vm = new ResultsViewModel(manager);
</script>

<div class="results">
  {#if vm.isFinalRound}
    <h1>Game Over!</h1>
    {#if vm.winner}
      <div class="winner-banner">
        <span class="trophy">🏆</span>
        <span>{vm.winner.name} wins with {vm.winner.score} points!</span>
      </div>
    {/if}
  {:else}
    <h1>Round {vm.roundNumber} Results</h1>
  {/if}

  <div class="matchup-recap">
    {#each vm.matchups as matchup}
      {@const totalVotes = matchup.answers.reduce((s, a) => s + a.votes, 0)}
      <div class="matchup-card">
        <div class="prompt">{matchup.promptText}</div>
        <div class="answers">
          {#each matchup.answers as answer}
            {@const otherAnswer = matchup.answers.find(a => a.id !== answer.id)}
            {@const isWinner = answer.votes > (otherAnswer?.votes ?? 0)}
            {@const isClash = answer.votes === totalVotes && answer.votes > 0}
            <div class="answer-card" class:winner={isWinner} class:clash={isClash}>
              <div class="answer-text">{answer.text}</div>
              <div class="answer-meta">
                <span class="author">by {vm.authorName(answer.authorId)}</span>
                <span class="votes">{answer.votes} vote{answer.votes !== 1 ? "s" : ""}</span>
                {#if isWinner}
                  <span class="trophy">🏆</span>
                {/if}
                {#if isClash}
                  <span class="clash-badge">CLASH!</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="scoreboard">
    {#each vm.scoreboard as entry}
      <div
        class="score-row"
        class:first={entry.rank === 1}
        class:is-me={entry.playerId === vm.myEntry?.playerId}
      >
        <div class="rank">#{entry.rank}</div>
        <div class="name">{entry.name}</div>
        <div class="round-points" class:positive={entry.roundPoints > 0}>
          {entry.roundPoints > 0 ? "+" : ""}{entry.roundPoints}
        </div>
        <div class="stats">
          {entry.matchupsWon}W
          {#if entry.hadClash}
            <span class="clash-badge">CLASH</span>
          {/if}
        </div>
        <div class="total-score">{entry.score}</div>
      </div>
    {/each}
  </div>

  {#if vm.isHost}
    <div class="actions">
      {#if vm.isFinalRound}
        <button class="btn play-again" onclick={() => vm.playAgain()}>
          Play Again
        </button>
      {:else}
        <button class="btn next-round" onclick={() => vm.nextRound()}>
          Next Round
        </button>
      {/if}
    </div>
  {:else}
    <p class="waiting">
      {#if vm.isFinalRound}
        Waiting for host to start a new game...
      {:else}
        Waiting for host to continue...
      {/if}
    </p>
  {/if}
</div>

<style>
  .results {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    text-align: center;
    font-size: 2rem;
    color: #333;
    margin: 0;
  }

  .winner-banner {
    text-align: center;
    padding: 20px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-radius: 16px;
    font-size: 1.4rem;
    font-weight: 600;
    color: #92400e;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 4px 16px rgba(146, 64, 14, 0.15);
  }

  .trophy {
    font-size: 2rem;
  }

  .matchup-recap {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .matchup-card {
    background: #f9fafb;
    border-radius: 12px;
    padding: 16px;
    border: 1px solid #e5e7eb;
  }

  .prompt {
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
    font-size: 1.1rem;
  }

  .answers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .answer-card {
    padding: 12px;
    border-radius: 8px;
    background: white;
    border: 2px solid #e5e7eb;
    transition: all 0.15s ease;
  }

  .answer-card.winner {
    border-color: #f59e0b;
    background: #fef3c7;
  }

  .answer-card.clash {
    border-color: #ef4444;
    background: #fee2e2;
  }

  .answer-text {
    margin-bottom: 8px;
    color: #1f2937;
    font-size: 0.95rem;
  }

  .answer-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #6b7280;
    flex-wrap: wrap;
  }

  .answer-meta .trophy {
    font-size: 1rem;
  }

  .scoreboard {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .score-row {
    display: grid;
    grid-template-columns: 40px 1fr 70px 100px 70px;
    align-items: center;
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 12px;
    border: 2px solid transparent;
    gap: 12px;
  }

  .score-row.first {
    background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
    border-color: #f59e0b;
    font-weight: 600;
  }

  .score-row.is-me {
    border-color: #667eea;
    background: #f5f3ff;
  }

  .rank {
    font-weight: 700;
    font-size: 1.1rem;
    color: #666;
  }

  .score-row.first .rank {
    color: #92400e;
  }

  .name {
    font-weight: 500;
    color: #333;
  }

  .round-points {
    font-weight: 600;
    color: #666;
    text-align: center;
  }

  .round-points.positive {
    color: #16a34a;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    color: #666;
  }

  .clash-badge {
    background: #f59e0b;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .total-score {
    font-weight: 700;
    font-size: 1.2rem;
    color: #333;
    text-align: right;
  }

  .actions {
    display: flex;
    justify-content: center;
    padding: 16px 0;
  }

  .btn {
    padding: 14px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .btn:active {
    transform: translateY(0);
  }

  .btn:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .next-round {
    background: linear-gradient(135deg, #667eea 0%, #7c3aed 100%);
    color: white;
  }

  .play-again {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
  }

  .waiting {
    text-align: center;
    color: #666;
    font-size: 1rem;
    padding: 20px;
    margin: 0;
  }

  @media (max-width: 600px) {
    .score-row {
      grid-template-columns: 35px 1fr 55px 60px;
      gap: 8px;
      padding: 10px 12px;
    }

    .stats {
      display: none;
    }

    h1 {
      font-size: 1.5rem;
    }

    .winner-banner {
      font-size: 1.1rem;
    }

    .answers {
      grid-template-columns: 1fr;
    }
  }
</style>
