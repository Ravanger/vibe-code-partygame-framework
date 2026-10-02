<script lang="ts">
interface Choice {
  id: string;
  text: string;
  isMine: boolean;
}

const {
  choices,
  canVote,
  onvote,
}: { choices: Choice[]; canVote: boolean; onvote: (id: string) => void } = $props();

const hasVoted = $derived(choices.some((choice) => choice.isMine));
</script>

<div class="board">
  {#each choices as choice, index (choice.id)}
    {#if index === 1}
      <span class="vs" aria-hidden="true">VS</span>
    {/if}
    <button
      type="button"
      class="answer card"
      class:picked={choice.isMine}
      disabled={!canVote}
      aria-pressed={choice.isMine}
      onclick={() => onvote(choice.id)}
    >
      {#if choice.isMine}
        <span class="sticker stamp" aria-hidden="true">VOTED!</span>
      {/if}
      <span class="words">{choice.text}</span>
    </button>
  {/each}
</div>

{#if canVote && hasVoted}
  <p class="switch-hint hand" role="status">psst… tap the other one to switch</p>
{/if}

<style>
  .board {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .answer {
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
    background: var(--sun);
  }

  .words {
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.35;
    overflow-wrap: anywhere;
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
    border-radius: var(--radius-pill);
    background: var(--pink);
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
