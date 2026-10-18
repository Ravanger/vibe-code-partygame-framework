<script lang="ts">
import { ActionBar, PlayerSticker } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { ResultsViewModel } from "../viewmodels/ResultsViewModel.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new ResultsViewModel(manager));
</script>

<div class="results stack">
  <h1>{vm.headline}</h1>

  <ul class="board">
    {#each vm.rows as row, i (row.playerId)}
      <li class="card" class:winner={i === 0 && row.score > 0} class:left={row.hasLeft}>
        <span class="rank">{`#${i + 1}`}</span>
        <PlayerSticker name={row.name} playerId={row.playerId} size={36} />
        <span class="name">{`${row.name}${row.hasLeft ? " (left)" : ""}`}</span>
        <span class="score">{row.score}</span>
      </li>
    {/each}
  </ul>

  {#if vm.isHost}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => void vm.playAgain()}>
        Play again
      </button>
    </ActionBar>
  {/if}
</div>

<style>
.results {
  gap: 1rem;
}

h1 {
  margin: 0.25rem 0 1rem;
  text-align: center;
}

.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.board li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.winner {
  outline: 3px solid var(--sun, #ffd23f);
}

.left {
  opacity: 0.6;
}

.rank {
  width: 2ch;
  font-weight: 700;
}

.name {
  flex: 1;
}

.score {
  font-size: 1.2rem;
  font-weight: 700;
}
</style>
