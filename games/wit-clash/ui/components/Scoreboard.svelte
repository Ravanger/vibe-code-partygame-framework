<script lang="ts">
import type { ScoreRow } from "../viewmodels/Scoreboard.js";

const { rows }: { rows: ScoreRow[] } = $props();
</script>

<div class="scoreboard">
  {#each rows as entry (entry.playerId)}
    <div class="score-row" class:first={entry.rank === 1} class:is-me={entry.isMe} class:left={entry.hasLeft}>
      <div class="rank">{`#${entry.rank}`}</div>
      <div class="name">{`${entry.name}${entry.hasLeft ? " (left)" : ""}`}</div>
      <div class="round-points" class:positive={entry.roundPoints > 0}>
        {`${entry.roundPoints > 0 ? "+" : ""}${entry.roundPoints}`}
      </div>
      <div class="stats">
        {`${entry.matchupsWon}W`}
        {#if entry.wonTieBreaker}
          <span class="tie-badge">TIE-BREAKER</span>
        {/if}
        {#if entry.hadClash}
          <span class="clash-badge">CLASH</span>
        {/if}
      </div>
      <div class="total-score">{entry.score}</div>
    </div>
  {/each}
</div>

<style>
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

  .score-row.left {
    opacity: 0.6;
  }

  .rank {
    font-weight: 700;
    font-size: 1.1rem;
    color: #666;
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

  .tie-badge {
    background: #7c3aed;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
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

  @media (max-width: 600px) {
    .score-row {
      grid-template-columns: 35px 1fr 55px 60px;
      gap: 8px;
      padding: 10px 12px;
    }

    .stats {
      display: none;
    }
  }
</style>
