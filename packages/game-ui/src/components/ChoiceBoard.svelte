<script lang="ts">
import { getStrings } from "../strings.js";

interface Choice {
  id: string;
  text: string;
  picked?: boolean;
  own?: boolean;
  label?: string;
}

const {
  choices,
  canVote,
  onvote,
  versus = "",
}: {
  choices: Choice[];
  canVote: boolean;
  onvote: (id: string) => void;
  versus?: string;
} = $props();
const strings = getStrings();

const hasPicked = $derived(choices.some((choice) => choice.picked));
</script>

<div class="board">
  {#each choices as choice, index (choice.id)}
    {#if versus !== "" && index === 1}
      <span class="vs" aria-hidden="true">{versus}</span>
    {/if}
    <button
      type="button"
      class="answer card"
      class:picked={choice.picked}
      disabled={!canVote || choice.own}
      aria-pressed={choice.picked ?? false}
      onclick={() => onvote(choice.id)}
    >
      {#if choice.label !== undefined}
        <span class="badge">{choice.label}</span>
      {/if}
      {#if choice.picked}
        <span class="sticker stamp" aria-hidden="true">{strings.pickedStamp}</span>
      {/if}
      <span class="words">{choice.text}</span>
      {#if choice.own}
        <span class="chip">{strings.yours}</span>
      {/if}
    </button>
  {/each}
</div>

{#if canVote && hasPicked}
  <p class="switch-hint hand" role="status">{strings.switchHint}</p>
{/if}

<style>
  .board {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .answer {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 7.5rem;
    padding: 1.25rem 1rem;
    font: inherit;
    text-align: center;
    cursor: pointer;
    --tilt: -1deg;
    transform: rotate(var(--tilt));
  }

  .answer:nth-of-type(even) {
    --tilt: 1deg;
  }

  .answer:disabled {
    color: var(--ink);
    cursor: default;
  }

  .answer.picked {
    background: var(--color-2);
  }

  .words {
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .badge {
    position: absolute;
    top: -0.8rem;
    left: -0.4rem;
    display: grid;
    place-items: center;
    width: calc(1.6rem * var(--scale, 1));
    height: calc(1.6rem * var(--scale, 1));
    border: var(--outline);
    border-radius: 50%;
    background: var(--color-3);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: var(--fs-2);
  }

  .stamp {
    position: absolute;
    top: -1.1rem;
    right: -0.4rem;
    font-size: var(--fs-2);
  }

  .vs {
    z-index: 1;
    justify-self: center;
    margin: -0.9rem 0;
    padding: 0.1rem 0.85rem;
    border: var(--outline);
    border-radius: 999px;
    background: var(--color-1);
    color: var(--ink);
    box-shadow: 2px 3px 0 var(--ink);
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    transform: rotate(-6deg);
  }

  .switch-hint {
    margin: 0.5rem 0 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  @media (prefers-reduced-motion: no-preference) {
    .answer {
      transition: transform 0.12s;
    }

    .answer:hover:not(:disabled) {
      transform: rotate(var(--tilt)) translateY(-3px);
    }
  }

  :global(main.tv) .board {
    grid-template-columns: 1fr auto 1fr;
    align-items: stretch;
    gap: 1.5rem;
    margin-top: 2.5rem;
  }

  :global(main.tv) .answer {
    min-height: 32dvh;
  }

  :global(main.tv) .words {
    font-size: calc(var(--fs-4) * var(--scale, 1));
  }

  :global(main.tv) .vs {
    align-self: center;
    margin: 0;
  }
</style>
