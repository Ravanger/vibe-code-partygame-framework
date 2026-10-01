<script lang="ts">
import { untrack } from "svelte";
import MatchupCard from "../components/MatchupCard.svelte";
import Podium from "../components/Podium.svelte";
import Scoreboard from "../components/Scoreboard.svelte";
import type { WitClashManager } from "../manager.js";
import { ResultsViewModel } from "../viewmodels/ResultsViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new ResultsViewModel(manager));
</script>

<div class="results">
  {#if vm.isFinalRound}
    <h1>Game Over!</h1>
    {#if vm.champions.length > 0}
      <div class="winner-banner">
        <span class="trophy" role="img" aria-label="Trophy">&#127942;</span>
        <span>
          {`${vm.champions.map((c) => c.name).join(" & ")} ${vm.champions.length > 1 ? "win" : "wins"} with ${vm.champions[0]?.score} points!`}
        </span>
      </div>
    {/if}
  {:else}
    <h1>{`${vm.roundLabel} Results`}</h1>
  {/if}

  <Podium steps={vm.podiumSteps} />

  {#if vm.bestAnswers.length > 0}
    <section class="best-answers" aria-label={vm.bestAnswerTitle}>
      <h2>{vm.bestAnswerTitle}</h2>
      {#each vm.bestAnswers as best}
        <figure class="best-answer">
          <figcaption class="best-prompt">{best.promptText}</figcaption>
          <blockquote class="best-text">{best.text}</blockquote>
          <div class="best-meta">
            <span class="best-author">{`by ${best.authorName}${best.isMine ? " (you)" : ""}`}</span>
            <span class="best-votes">{`${best.votes} vote${best.votes !== 1 ? "s" : ""}`}</span>
          </div>
        </figure>
      {/each}
    </section>
  {/if}

  <div class="matchup-recap">
    {#each vm.matchups as matchup}
      <MatchupCard {matchup} />
    {/each}
  </div>

  <Scoreboard rows={vm.scoreboard.rows} />

  {#if vm.showNextRound}
    <div class="actions">
      <button type="button" class="btn next-round" onclick={() => vm.nextRound()}>Next Round</button>
    </div>
  {:else if vm.showPlayAgain}
    <div class="actions">
      <button type="button" class="btn play-again" onclick={() => vm.playAgain()}>Play Again</button>
    </div>
  {:else}
    <p class="waiting">
      {vm.isFinalRound ? "Waiting for host to start a new game..." : "Waiting for host to continue..."}
    </p>
  {/if}
</div>

<style>
  .results {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    text-align: center;
    font-size: 2rem;
    color: #333;
    margin: 0;
  }

  .winner-banner {
    text-align: center;
    padding: 20px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-radius: 16px;
    font-size: 1.4rem;
    font-weight: 600;
    color: #92400e;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 4px 16px rgba(146, 64, 14, 0.15);
  }

  .trophy {
    font-size: 2rem;
  }

  .best-answers {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .best-answers h2 {
    margin: 0;
    color: #92400e;
    font-size: 1.3rem;
  }

  .best-answer {
    margin: 0;
    padding: 16px 20px;
    background: #fffbeb;
    border: 2px solid #f59e0b;
    border-radius: 16px;
  }

  .best-prompt {
    color: #666;
    font-size: 0.95rem;
  }

  .best-text {
    margin: 8px 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #333;
  }

  .best-meta {
    display: flex;
    justify-content: center;
    gap: 16px;
    color: #666;
  }

  :global(main.tv) .best-answers h2 {
    font-size: 2.4rem;
  }

  :global(main.tv) .best-prompt,
  :global(main.tv) .best-meta {
    font-size: 1.8rem;
  }

  :global(main.tv) .best-text {
    font-size: 3rem;
  }

  .matchup-recap {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .actions {
    display: flex;
    justify-content: center;
    padding: 16px 0;
  }

  .btn {
    padding: 14px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: white;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .btn:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .next-round {
    background: linear-gradient(135deg, #667eea 0%, #7c3aed 100%);
  }

  .play-again {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  }

  .waiting {
    text-align: center;
    color: #666;
    font-size: 1rem;
    padding: 20px;
    margin: 0;
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 1.5rem;
    }

    .winner-banner {
      font-size: 1.1rem;
    }
  }
</style>
