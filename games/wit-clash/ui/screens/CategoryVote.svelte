<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { CategoryVoteViewModel } from "../viewmodels/CategoryVoteViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

// svelte-ignore state_referenced_locally -- manager is a stable long-lived instance, never reassigned by the parent
const vm = new CategoryVoteViewModel(manager);

$effect(() => {
  return () => vm.destroy();
});
</script>

<div class="category-vote">
  <h1>Pick a category</h1>

  <div class="timer" class:urgent={vm.isUrgent}>
    <span aria-live="polite" aria-atomic="true">{vm.countdownAnnouncement}</span>
    {vm.secondsLeft}s
  </div>

  <div class="cards">
    {#each vm.options as option}
      <button
        class="card"
        class:selected={vm.myVote === option.id}
        onclick={() => vm.vote(option.id)}
        aria-pressed={vm.myVote === option.id}
      >
        <span class="emoji">{option.emoji}</span>
        <span class="name">{option.name}</span>
        <span class="votes">{option.votes} vote{option.votes !== 1 ? "s" : ""}</span>
      </button>
    {/each}
  </div>

  <p class="footer">
    {vm.totalVotes} of {vm.playerCount} voted
  </p>
</div>

<style>
  .category-vote {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    text-align: center;
    font-size: 2rem;
    margin: 0;
    color: #333;
  }

  .timer {
    text-align: center;
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

  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (max-width: 600px) {
    .cards {
      grid-template-columns: 1fr;
    }
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    border: 3px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border-color: #667eea;
  }

  .card:active {
    transform: translateY(0);
  }

  .card:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .card.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .emoji {
    font-size: 3rem;
  }

  .name {
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
  }

  .votes {
    font-size: 0.9rem;
    color: #666;
  }

  .footer {
    text-align: center;
    font-size: 1rem;
    color: #666;
    margin: 0;
  }
</style>
