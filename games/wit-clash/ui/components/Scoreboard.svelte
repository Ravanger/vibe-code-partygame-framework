<script lang="ts">
import { PlayerSticker } from "@partygame/game-ui/components";
import type { ScoreRow } from "../viewmodels/Scoreboard.js";

const { rows }: { rows: ScoreRow[] } = $props();
</script>

<ol class="scoreboard" aria-label="Scoreboard">
  {#each rows as entry (entry.playerId)}
    <li class="score-row card" class:first={entry.rank === 1} class:is-me={entry.isMe} class:left={entry.hasLeft}>
      <span class="rank">{`#${entry.rank}`}</span>
      <PlayerSticker name={entry.name} playerId={entry.playerId} size={40} />
      <div class="who">
        <span class="name">{`${entry.name}${entry.hasLeft ? " (left)" : ""}`}</span>
        <span class="stats">
          {`${entry.matchupsWon}W`}
          {#if entry.isMe}
            <span class="you hand">&larr; you</span>
          {/if}
          {#if entry.wonTieBreaker}
            <span class="chip chip--sky">TIE-BREAKER</span>
          {/if}
          {#if entry.hadClash}
            <span class="chip chip--pink">CLASH</span>
          {/if}
        </span>
      </div>
      <span class="chip round-points" class:positive={entry.roundPoints > 0}>
        {`${entry.roundPoints > 0 ? "+" : ""}${entry.roundPoints}`}
      </span>
      <span class="total-score">{entry.score}</span>
    </li>
  {/each}
</ol>

<style>
  .scoreboard {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .score-row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 0.5rem 0.75rem;
    box-shadow: 2px 3px 0 var(--ink);
  }

  .score-row.first {
    background: var(--sun);
  }

  .score-row.is-me:not(.first) {
    background: var(--paper);
  }

  .score-row.left {
    opacity: 0.65;
  }

  .rank {
    min-width: 2ch;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    color: var(--ink-soft);
  }

  .first .rank {
    color: var(--ink);
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    overflow-wrap: anywhere;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.15;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    color: var(--ink-soft);
    font-size: calc(var(--fs-1) * var(--scale, 1));
  }

  .first .stats {
    color: var(--ink);
  }

  .you {
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .round-points {
    background: var(--white);
    font-variant-numeric: tabular-nums;
  }

  .round-points.positive {
    background: var(--mint);
  }

  .total-score {
    font-family: var(--font-display);
    font-size: calc(var(--fs-4) * var(--scale, 1));
    min-width: 2.4ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 380px) {
    .score-row {
      grid-template-columns: auto auto minmax(0, 1fr) auto auto;
      gap: 6px;
      padding: 0.5rem;
    }
  }

  :global(main.tv) .scoreboard {
    gap: 0.5rem;
  }

  :global(main.tv) .score-row {
    padding: 0.25rem 0.75rem;
  }
</style>
