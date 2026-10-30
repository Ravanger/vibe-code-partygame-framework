<script lang="ts" generics="TState extends BaseGameState">
import type { GameControlsViewModel } from "@partygame/game-ui";
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import { tick } from "svelte";
import { getStrings } from "../strings.js";
import { nextId } from "./uniqueId.js";

const { vm }: { vm: GameControlsViewModel<TState> } = $props();
const strings = getStrings();

let root = $state<HTMLElement>();
let menuBtn = $state<HTMLButtonElement>();
let endBtn = $state<HTMLButtonElement>();
let leaveBtn = $state<HTMLButtonElement>();
const popoverId = nextId("game-controls-popover");
const confirmTitleId = nextId("game-controls-confirm-title");

function closeOnOutsideClick(event: MouseEvent): void {
  if (!vm.menuOpen || event.composedPath().some((node) => node === root)) return;
  vm.closeMenu();
  menuBtn?.focus();
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (!vm.menuOpen) return;
  if (event.key === "Escape") {
    vm.closeMenu();
    menuBtn?.focus();
    return;
  }
  // Tab from the last item closes the menu instead of leaving it.
  if (event.key !== "Tab" || event.shiftKey) return;
  if (document.activeElement === leaveBtn) {
    event.preventDefault();
    vm.closeMenu();
    menuBtn?.focus();
  }
}

async function onMenuClick(): Promise<void> {
  const opening = !vm.menuOpen;
  vm.toggleMenu();
  if (!opening) return;
  await tick();
  (vm.canEndGame ? endBtn : leaveBtn)?.focus();
}
</script>

<svelte:window onclick={closeOnOutsideClick} onkeydown={onWindowKeydown} />

{#if vm.isVisible}
  <div class="game-controls" bind:this={root}>
    {#if vm.isSpectator}
      <button type="button" class="btn btn--ghost leave-small" onclick={() => vm.leave()}>
        {strings.leaveGame}
      </button>
    {:else}
      <button
        type="button"
        class="btn menu-btn"
        aria-label={strings.gameMenu}
        aria-haspopup="true"
        aria-expanded={vm.menuOpen}
        aria-controls={popoverId}
        bind:this={menuBtn}
        onclick={() => onMenuClick()}
      >&#8943;</button>
      {#if vm.menuOpen}
        <div class="popover card" id={popoverId}>
          {#if vm.canEndGame}
            {#if vm.confirmingEnd}
              <div class="confirm-dialog" role="alertdialog" aria-labelledby={confirmTitleId}>
                <p id={confirmTitleId} class="confirm">{strings.confirmEndGame}</p>
                <div class="confirm-actions">
                  <button type="button" class="btn btn--danger" onclick={() => vm.confirmEnd()}>
                    {strings.yes}
                  </button>
                  <button type="button" class="btn" onclick={() => vm.cancelEnd()}>{strings.no}</button>
                </div>
              </div>
            {:else}
              <button
                type="button"
                class="btn btn--danger"
                bind:this={endBtn}
                onclick={() => vm.askEnd()}
              >{strings.endGame}</button>
            {/if}
          {/if}
          <button type="button" class="btn" bind:this={leaveBtn} onclick={() => vm.leave()}>
            {strings.leaveGame}
          </button>
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

  .confirm-dialog {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
