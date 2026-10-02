<script lang="ts" generics="TState extends BaseGameState">
import type { GameControlsViewModel } from "@partygame/game-ui";
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";

const { vm }: { vm: GameControlsViewModel<TState> } = $props();

let root = $state<HTMLElement>();

function closeOnOutsideClick(event: MouseEvent): void {
  if (vm.menuOpen && !event.composedPath().some((node) => node === root)) vm.closeMenu();
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") vm.closeMenu();
}
</script>

<svelte:window onclick={closeOnOutsideClick} onkeydown={closeOnEscape} />

{#if vm.isVisible}
  <div class="game-controls" bind:this={root}>
    {#if vm.isSpectator}
      <button type="button" class="btn btn--ghost leave-small" onclick={() => vm.leave()}>Leave game</button>
    {:else}
      <button
        type="button"
        class="btn menu-btn"
        aria-label="Game menu"
        aria-haspopup="true"
        aria-expanded={vm.menuOpen}
        onclick={() => vm.toggleMenu()}
      >&#8943;</button>
      {#if vm.menuOpen}
        <div class="popover card">
          {#if vm.canEndGame}
            {#if vm.confirmingEnd}
              <p class="confirm">End the game for everyone?</p>
              <div class="confirm-actions">
                <button type="button" class="btn btn--danger" onclick={() => vm.confirmEnd()}>Yes</button>
                <button type="button" class="btn" onclick={() => vm.cancelEnd()}>No</button>
              </div>
            {:else}
              <button type="button" class="btn btn--danger" onclick={() => vm.askEnd()}>End game</button>
            {/if}
          {/if}
          <button type="button" class="btn" onclick={() => vm.leave()}>Leave game</button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .game-controls {
    position: relative;
  }

  .menu-btn {
    min-width: 44px;
    padding: 0 0.6rem;
    font-size: var(--fs-4);
    line-height: 1;
  }

  .leave-small {
    min-height: 36px;
    font-size: var(--fs-1);
    padding: 0.2rem 0.7rem;
  }

  .popover {
    position: absolute;
    right: 0;
    top: calc(100% + 10px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 220px;
    padding: 0.9rem;
  }

  .confirm {
    margin: 0;
    font-weight: 600;
  }

  .confirm-actions {
    display: flex;
    gap: 0.75rem;
  }

  .confirm-actions .btn {
    flex: 1;
  }
</style>
