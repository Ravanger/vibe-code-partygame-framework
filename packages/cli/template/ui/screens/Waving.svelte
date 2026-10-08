<script lang="ts">
import { ActionBar, PlayerSticker } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { __PascalName__Manager } from "../manager.js";
import { WavingViewModel } from "../viewmodels/WavingViewModel.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new WavingViewModel(manager));
</script>

<div class="waving">
  <h1>Wave!</h1>
  <ul class="board">
    {#each vm.rows as row, i (row.id)}
      <li class="row" class:leader={i === 0 && row.waves > 0} class:me={row.isMe}>
        <span class="rank">{`#${i + 1}`}</span>
        <PlayerSticker name={row.name} playerId={row.id} size={36} />
        <span class="name">{row.name}</span>
        <span class="count">{`${row.waves}`}</span>
      </li>
    {/each}
  </ul>

  {#if manager.isSpectator}
    <p class="watching">Watch the waves fly.</p>
  {:else}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => vm.wave()}>
        {`Wave! (${vm.myWaves})`}
      </button>
    </ActionBar>
  {/if}
</div>

<style>
  .waving {
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0.25rem 0 1rem;
    text-align: center;
    font-size: var(--fs-5);
  }

  .board {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--white);
  }

  .row.leader {
    background: var(--sun);
  }

  .row.me {
    background: var(--fill, #fff8ea);
  }

  .rank {
    font-family: var(--font-display);
    color: var(--ink-soft);
  }

  .name {
    flex: 1;
    font-weight: 600;
  }

  .count {
    font-family: var(--font-display);
    font-size: var(--fs-3);
  }

  .watching {
    margin-top: auto;
    padding: 2rem;
    text-align: center;
    color: var(--ink-soft);
    font-size: var(--fs-3);
  }
</style>
