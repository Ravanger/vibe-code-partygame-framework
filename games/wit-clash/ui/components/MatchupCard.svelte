<script lang="ts">
import type { RevealedMatchup } from "../viewmodels/MatchupRecap.js";

const { matchup }: { matchup: RevealedMatchup } = $props();
</script>

<div class="matchup-card">
  <div class="prompt">{matchup.promptText}</div>
  {#if matchup.isForfeit}
    <p class="forfeit">Won by forfeit: nobody else answered.</p>
  {/if}
  <div class="answers">
    {#each matchup.answers as answer (answer.id)}
      <div class="answer-card" class:winner={answer.isWinner} class:clash={answer.isWinner && matchup.isClash}>
        <div class="answer-text">{answer.text}</div>
        <div class="answer-meta">
          <span class="author">{`by ${answer.authorName}${answer.isMine ? " (you)" : ""}`}</span>
          {#if !matchup.isForfeit}
            <span class="votes">{`${answer.votes} vote${answer.votes !== 1 ? "s" : ""}`}</span>
          {/if}
          {#if answer.isWinner}
            <span class="trophy" role="img" aria-label="Winner">&#127942;</span>
          {/if}
          {#if answer.isWinner && matchup.isClash}
            <span class="clash-badge">CLASH!</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
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

  .forfeit {
    margin: 0 0 12px;
    color: #92400e;
    font-style: italic;
  }

  .answers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 600px) {
    .answers {
      grid-template-columns: 1fr;
    }
  }

  .answer-card {
    padding: 12px;
    border-radius: 8px;
    background: white;
    border: 2px solid #e5e7eb;
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

  .clash-badge {
    background: #ef4444;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
  }
</style>
