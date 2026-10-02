<script lang="ts">
import { PlayerSticker } from "@partygame/game-ui/components";
import type { ProgressRow } from "../viewmodels/AnswerProgress.js";

const { rows }: { rows: ProgressRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="strip" aria-label="Answer progress">
    {#each rows as row (row.playerId)}
      <li class="friend" class:done={row.done} class:is-me={row.isMe} class:idle={!row.done && !row.typing} title={row.name}>
        <span class="face">
          <PlayerSticker name={row.name} playerId={row.playerId} size={46} />
          {#if row.done}
            <span class="mark mark-done" role="img" aria-label="Done">&#10003;</span>
          {:else if row.typing}
            <svg class="mark mark-typing" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 21l1.5-5L16 4.5 19.5 8 8 19.5z" />
              <path d="M14 6.5l3.5 3.5" />
            </svg>
          {/if}
        </span>
        <span class="who">{row.name}</span>
        <span class="count">{`${row.answered}/${row.expected}`}</span>
        {#if row.typing}
          <span class="typing hand">typing…</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .strip {
    display: flex;
    gap: 0.75rem;
    margin: 0.5rem 0 0;
    padding: 0.4rem 0.25rem 0.5rem;
    overflow-x: auto;
    list-style: none;
  }

  .friend {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    max-width: 5.5rem;
    gap: 0.05rem;
    font-size: calc(var(--fs-1) * var(--scale, 1));
    line-height: 1.2;
  }

  .face {
    position: relative;
    display: inline-flex;
  }

  .idle .face {
    opacity: 0.55;
  }

  .mark {
    position: absolute;
    right: -6px;
    bottom: -4px;
    display: grid;
    place-items: center;
    width: calc(22px * var(--scale, 1));
    height: calc(22px * var(--scale, 1));
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--mint);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: calc(var(--fs-1) * var(--scale, 1));
    line-height: 1;
  }

  .mark-typing {
    padding: 3px;
    background: var(--sun);
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .who {
    max-width: 100%;
    overflow: hidden;
    font-family: var(--font-display);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .is-me .who {
    text-decoration: underline wavy var(--pink);
    text-underline-offset: 3px;
  }

  .count {
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .typing {
    color: var(--ink-soft);
  }

  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(-12deg);
    }
    50% {
      transform: rotate(12deg);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .mark-typing {
      animation: wiggle 0.5s ease-in-out infinite;
    }
  }

  :global(main.tv) .strip {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem 2rem;
    overflow: visible;
  }

  :global(main.tv) .friend {
    max-width: 9rem;
  }
</style>
