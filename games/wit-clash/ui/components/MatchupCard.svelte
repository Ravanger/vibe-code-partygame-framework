<script lang="ts">
import { PlayerSticker } from "@partygame/game-ui/components";
import type { RevealedMatchup } from "../viewmodels/MatchupRecap.js";

const {
  matchup,
  myVoteId = "",
  flip = false,
}: { matchup: RevealedMatchup; myVoteId?: string; flip?: boolean } = $props();
</script>

<div class="matchup-card" class:flip={flip}>
  <div class="question card taped">
    <p class="question-text">{matchup.promptText}</p>
  </div>
  {#if matchup.isForfeit}
    <p class="forfeit hand">Won by forfeit: nobody else answered.</p>
  {/if}
  <div class="face-off">
    {#each matchup.answers as answer, index (answer.id)}
      {#if index === 1}
        <span class="vs" aria-hidden="true">VS</span>
      {/if}
      <article
        class="reply card"
        class:winner={answer.isWinner}
        class:clash={answer.isWinner && matchup.isClash}
        style:--delay={`${index * 0.6}s`}
      >
        <div class="stickers">
          {#if answer.id === myVoteId}
            <span class="sticker sticker--pick" aria-hidden="true">MY PICK</span>
          {/if}
          {#if answer.isWinner && matchup.isClash}
            <span class="sticker sticker--clash">CLASH!</span>
          {/if}
          {#if matchup.isForfeit && !answer.isWinner}
            <span class="sticker sticker--out">NO SHOW</span>
          {/if}
        </div>
        <p class="words">{answer.text}</p>
        <div class="meta">
          <PlayerSticker name={answer.authorName} playerId={answer.authorId} size={34} />
          <span class="by">{`by ${answer.authorName}${answer.isMine ? " (you)" : ""}`}</span>
          {#if !matchup.isForfeit}
            <span class="chip chip--paper">{`${answer.votes} vote${answer.votes !== 1 ? "s" : ""}`}</span>
          {/if}
          {#if answer.isWinner}
            <span class="trophy" role="img" aria-label="Winner">&#127942;</span>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  .matchup-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .question {
    --tilt: -1deg;
    text-align: center;
  }

  .question-text {
    margin: 0;
    font-family: var(--font-display);
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1.25;
  }

  .forfeit {
    margin: 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  .face-off {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .vs {
    z-index: 1;
    justify-self: center;
    margin: -0.9rem 0;
    padding: 0.1rem 0.85rem;
    border: var(--outline);
    border-radius: var(--radius-pill);
    background: var(--pink);
    box-shadow: 2px 3px 0 var(--ink);
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    transform: rotate(-6deg);
  }

  .reply {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1.25rem;
  }

  .reply.winner {
    background: var(--sun);
  }

  .stickers {
    position: absolute;
    top: -1.1rem;
    right: -0.4rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.4rem;
    font-size: var(--fs-2);
  }

  .stickers .sticker {
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .sticker--clash {
    background: var(--pink);
  }

  .sticker--pick {
    background: var(--sky);
  }

  .sticker--out {
    background: var(--disabled);
  }

  .words {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    text-align: center;
    font-size: calc(var(--fs-3) * var(--scale, 1));
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: calc(var(--fs-1) * var(--scale, 1));
  }

  .by {
    font-weight: 700;
  }

  .trophy {
    font-size: calc(var(--fs-6) * var(--scale, 1));
    line-height: 1;
  }

  @keyframes flip-in {
    from {
      opacity: 0;
      transform: perspective(700px) rotateX(-85deg);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes trophy-pop {
    0% {
      transform: scale(0) rotate(-30deg);
    }
    70% {
      transform: scale(1.25) rotate(8deg);
    }
    100% {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .flip .reply {
      transform-origin: top center;
      animation: flip-in 0.45s ease-out backwards;
      animation-delay: var(--delay);
    }

    .flip .stickers .sticker,
    .flip .trophy {
      animation-fill-mode: backwards;
      animation-delay: calc(var(--delay) + 0.5s);
    }

    .flip .trophy {
      animation-name: trophy-pop;
      animation-duration: 0.5s;
    }
  }

  :global(main.tv) .face-off {
    grid-template-columns: 1fr auto 1fr;
    align-items: stretch;
    gap: 1.5rem;
    margin-top: 2.5rem;
  }

  :global(main.tv) .vs {
    align-self: center;
    margin: 0;
  }

  :global(main.tv) .question-text {
    font-size: calc(var(--fs-5) * var(--scale, 1));
  }

  :global(main.tv) .words {
    font-size: calc(var(--fs-4) * var(--scale, 1));
  }

  :global(main.tv) .reply {
    min-height: 28dvh;
  }
</style>
