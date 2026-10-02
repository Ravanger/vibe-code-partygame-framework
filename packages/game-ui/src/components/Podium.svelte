<script lang="ts" generics="TRow extends PodiumRow">
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { PodiumRow, PodiumStep } from "@partygame/game-ui";
import type { Snippet } from "svelte";
import PlayerSticker from "./PlayerSticker.svelte";

const { steps, extra }: { steps: PodiumStep<TRow>[]; extra?: Snippet<[TRow]> } = $props();

const stickerSize = (step: PodiumStep<TRow>): number => {
  if (step.players.length > 1) return 36;
  return step.tier === 1 ? 64 : 52;
};
</script>

{#if steps.length > 0}
  <ol class="podium" aria-label="Podium">
    {#each steps as step (step.rank)}
      <li class={`step tier-${step.tier}`}>
        <div class="occupants">
          {#each step.players as player (player.playerId)}
            <div class="occupant" class:is-me={player.isMe}>
              {#if step.tier === 1}
                <span class="star" aria-hidden="true">&#9733;</span>
              {/if}
              <PlayerSticker name={player.name} playerId={player.playerId} size={stickerSize(step)} />
              <span class="occupant-name">{player.name}</span>
              {#if player.isMe}
                <span class="you hand">&larr; you</span>
              {/if}
              {#if extra}{@render extra(player)}{/if}
              <span class="occupant-score">{`${player.score} pts`}</span>
            </div>
          {/each}
        </div>
        <div class="block">{step.label}</div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .podium {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0 0;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 6px;
  }

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
  }

  .occupants {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 0.5rem 0.75rem;
  }

  .occupant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .star {
    color: var(--sun);
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1;
  }

  .occupant-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.15;
  }

  .is-me .occupant-name {
    text-decoration: underline wavy var(--pink) 3px;
    text-underline-offset: 4px;
  }

  .you {
    color: var(--ink-soft);
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .occupant-score {
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: calc(var(--fs-1) * var(--scale, 1));
  }

  .block {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 6px;
    border: var(--outline);
    border-bottom: none;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    background: var(--sky);
    color: var(--ink);
    box-shadow: var(--scrap-shadow);
    font-family: var(--font-display);
    font-size: calc(var(--fs-5) * var(--scale, 1));
  }

  .tier-1 .block {
    height: calc(150px * var(--scale, 1));
    background: var(--sun);
  }

  .tier-2 .block {
    height: calc(108px * var(--scale, 1));
  }

  .tier-3 .block {
    height: calc(78px * var(--scale, 1));
    background: var(--pink);
  }

  :global(main.tv) .tier-1 .block {
    height: 17dvh;
  }

  :global(main.tv) .tier-2 .block {
    height: 12dvh;
  }

  :global(main.tv) .tier-3 .block {
    height: 8dvh;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
    60% {
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .step {
      animation: rise 0.6s ease-out both;
    }

    .tier-2 {
      animation-delay: 0.15s;
    }

    .tier-1 {
      animation-delay: 0.3s;
    }

    .tier-3 {
      animation-delay: 0s;
    }
  }
</style>
