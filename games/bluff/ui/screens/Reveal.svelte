<script lang="ts">
import { Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { RevealViewModel } from "../viewmodels/RevealViewModel.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new RevealViewModel(manager));
</script>

<div class="reveal stack">
  <p class="round">{vm.roundLabel}</p>
  <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} />

  <ul class="choices">
    {#each vm.choices as choice (choice.id)}
      <li class="card" class:truth={choice.isTruth}>
        <span class="text">{choice.text}</span>
        <span class="meta">{`${choice.authorName} · ${choice.votes} vote${choice.votes === 1 ? "" : "s"}`}</span>
        {#if choice.isTruth}<span class="chip chip--paper">the truth</span>{/if}
      </li>
    {/each}
  </ul>

  <ul class="results">
    {#each vm.results as entry (entry.playerId)}
      <li>
        <span class="name">{entry.name}</span>
        <span class="pts">{`+${entry.roundPoints}`}</span>
        <span class="tag"
          >{entry.guessedTruth ? "guessed the truth" : `${entry.fooledCount} fooled`}</span
        >
      </li>
    {/each}
  </ul>
</div>

<style>
.reveal {
  gap: 1rem;
}

.round {
  margin: 0;
  opacity: 0.7;
}

.choices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.choices li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.truth {
  outline: 3px solid var(--color-2, #ffd23f);
}

.text {
  flex: 1;
}

.meta {
  opacity: 0.7;
  white-space: nowrap;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.results li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.name {
  flex: 1;
}

.pts {
  font-weight: 700;
}

.tag {
  opacity: 0.7;
  white-space: nowrap;
}
</style>
