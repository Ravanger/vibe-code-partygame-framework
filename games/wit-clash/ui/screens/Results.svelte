<script lang="ts">
import { untrack } from "svelte";
import ActionBar from "../components/ActionBar.svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import PlayerSticker from "../components/PlayerSticker.svelte";
import Podium from "../components/Podium.svelte";
import Scoreboard from "../components/Scoreboard.svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import { confettiPieces } from "../confetti.js";
import type { WitClashManager } from "../manager.js";
import { ResultsViewModel } from "../viewmodels/ResultsViewModel.js";
import { Spotlight } from "../viewmodels/Spotlight.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new ResultsViewModel(manager));
const pieces = confettiPieces(40);
const spotlight = new Spotlight(() => (vm.isSpectator && vm.bestAnswers.length > 0 ? 2 : 1));
const showBest = $derived(spotlight.isActive && spotlight.current === 1);

$effect(() => () => spotlight.destroy());
</script>

<div class="results" class:final={vm.isFinalRound}>
  {#if vm.isFinalRound}
    <div class="confetti" aria-hidden="true">
      {#each pieces as piece}
        <i
          style:left={`${piece.left}%`}
          style:animation-delay={`${piece.delay}s`}
          style:animation-duration={`${piece.duration}s`}
          style:--drift={`${piece.drift}vw`}
          style:background={piece.color}
        ></i>
      {/each}
    </div>
  {/if}

  <div class="head">
    {#if vm.isFinalRound}
      <h1>Game Over!</h1>
      {#if vm.champions.length > 0}
        <div class="winner-banner card taped">
          <span class="winner-stickers">
            {#each vm.champions as champion (champion.playerId)}
              <PlayerSticker name={champion.name} playerId={champion.playerId} size={64} />
            {/each}
          </span>
          <span class="winner-line">{vm.championLine}</span>
          <span class="trophy" role="img" aria-label="Trophy">&#127942;</span>
        </div>
      {/if}
    {:else}
      <h1>{`${vm.roundLabel} Results`}</h1>
    {/if}
  </div>

  <div class="stage">
    <div class="podium-panel" class:faded={showBest}>
      <Podium steps={vm.podiumSteps} />
    </div>

    {#if vm.bestAnswers.length > 0}
      <section class="best-answers" class:faded={spotlight.isActive && !showBest} aria-label={vm.bestAnswerTitle} style:--count={vm.bestAnswers.length}>
        <h2 class="sticker">{vm.bestAnswerTitle}</h2>
        {#each vm.bestAnswers as best}
          <figure class="best-answer card taped">
            <figcaption class="best-prompt">{best.promptText}</figcaption>
            <blockquote class="best-text">{best.text}</blockquote>
            <div class="best-meta">
              <span class="best-author">{`by ${best.authorName}${best.isMine ? " (you)" : ""}`}</span>
              <span class="chip">{`${best.votes} vote${best.votes !== 1 ? "s" : ""}`}</span>
            </div>
          </figure>
        {/each}
      </section>
    {/if}
  </div>

  <div class="board">
    <Scoreboard rows={vm.scoreboard.rows} />

    {#if vm.matchups.length > 0}
      <details class="recap card">
        <summary>Matchup recap</summary>
        <div class="matchup-recap">
          {#each vm.matchups as matchup}
            <MatchupCard {matchup} />
          {/each}
        </div>
      </details>
    {/if}

    {#if !vm.isHost}
      <StatusPanel tone="wait" title={vm.waitingText} />
    {/if}
  </div>

  {#if vm.showNextRound}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => vm.nextRound()}>Next Round</button>
    </ActionBar>
  {:else if vm.showPlayAgain}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => vm.playAgain()}>Play Again</button>
    </ActionBar>
  {/if}
</div>

<style>
  .results {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .head,
  .stage,
  .board {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: calc(var(--fs-5) * var(--scale, 1));
    line-height: 1.1;
    text-align: center;
    text-decoration: underline wavy var(--pink) 3px;
    text-underline-offset: 8px;
  }

  .winner-banner {
    --tape: var(--tape-mint);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: var(--sun);
    text-align: center;
  }

  .winner-stickers {
    display: inline-flex;
    gap: 0.25rem;
  }

  .winner-line {
    font-family: var(--font-display);
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1.15;
  }

  .trophy {
    font-size: calc(var(--fs-5) * var(--scale, 1));
  }

  .best-answers {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .best-answers h2 {
    margin: 0;
  }

  .best-answer {
    --tape: var(--tape-sky);
    width: 100%;
    margin: 0;
    background: var(--sun);
    text-align: center;
  }

  .best-prompt {
    color: var(--ink-soft);
    font-family: var(--font-hand);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .best-text {
    margin: 0.5rem 0;
    font-size: calc(var(--fs-4) * var(--scale, 1));
    font-weight: 700;
  }

  .best-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .best-meta .chip {
    background: var(--white);
  }

  .recap summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    cursor: pointer;
  }

  .matchup-recap {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .confetti {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 20;
  }

  .confetti i {
    display: none;
    position: absolute;
    top: -3vh;
    width: 10px;
    height: 16px;
    border: 2px solid var(--ink);
  }

  @keyframes fall {
    from {
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    to {
      transform: translate(var(--drift), 108vh) rotate(720deg);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .confetti i {
      display: block;
      animation: fall linear 1 both;
    }
  }

  :global(main.tv) .results {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "head head"
      "stage board";
    align-items: start;
    gap: 1.5rem 3rem;
  }

  :global(main.tv) .results .head {
    grid-area: head;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 2rem;
  }

  :global(main.tv) .results .stage {
    grid-area: stage;
    display: grid;
    align-items: center;
  }

  :global(main.tv) .results .stage > * {
    grid-area: 1 / 1;
  }

  .faded {
    opacity: 0;
    visibility: hidden;
  }

  @media (prefers-reduced-motion: no-preference) {
    .podium-panel,
    .best-answers {
      transition:
        opacity 0.8s ease,
        visibility 0.8s;
    }
  }

  :global(main.tv) .results .board {
    grid-area: board;
    gap: 1rem;
  }

  :global(main.tv) .winner-banner {
    padding: 0.5rem 1.5rem;
  }

  :global(main.tv) .best-answers {
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 1.25rem 1rem;
  }

  :global(main.tv) .best-answers h2 {
    grid-column: 1 / -1;
    justify-self: center;
  }

  :global(main.tv) .best-answer {
    padding: 0.75rem 1rem;
  }

  :global(main.tv) .best-prompt {
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  :global(main.tv) .best-text {
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  :global(main.tv) .results .recap {
    display: none;
  }

</style>
