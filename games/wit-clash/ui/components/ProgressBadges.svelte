<script lang="ts">
import type { ProgressRow } from "../viewmodels/AnswerProgress.js";

const { rows }: { rows: ProgressRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="progress-list" aria-label="Answer progress">
    {#each rows as row (row.playerId)}
      <li class="progress-chip" class:done={row.done} class:is-me={row.isMe}>
        <span class="progress-name">{row.name}</span>
        <span class="progress-count">{`${row.answered}/${row.expected}`}</span>
        {#if row.done}
          <span class="progress-tick" role="img" aria-label="Done">&#10003;</span>
        {:else if row.typing}
          <span class="progress-typing">typing…</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .progress-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .progress-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 999px;
    font-size: 0.95rem;
  }

  .progress-chip.done {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .progress-chip.is-me {
    border-color: #667eea;
  }

  .progress-name {
    font-weight: 600;
  }

  .progress-count {
    color: #666;
    font-variant-numeric: tabular-nums;
  }

  .progress-tick {
    color: #16a34a;
    font-weight: 700;
  }

  .progress-typing {
    color: #667eea;
    font-style: italic;
  }

  :global(main.tv) .progress-chip {
    font-size: 2rem;
    padding: 10px 24px;
  }
</style>
