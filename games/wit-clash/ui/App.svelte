<script lang="ts">
import { GameControls } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { WitClashManager } from "./manager.js";
import { PHASE_SCREENS } from "./screens/index.js";
import JoinNextRound from "./screens/JoinNextRound.svelte";
import Welcome from "./screens/Welcome.svelte";
import { AppViewModel } from "./viewmodels/AppViewModel.js";
import { GameControlsViewModel } from "./viewmodels/GameControlsViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new AppViewModel(manager));
const controls = untrack(() => new GameControlsViewModel(manager));
const route = $derived(vm.screen);
</script>

<main class:tv={vm.isSpectator}>
  {#if route.kind !== 'welcome'}
    <header>
      <span class="wordmark">WitClash</span>
      <span class="room-chip">{vm.roomCode}</span>
      <GameControls vm={controls} />
    </header>
  {/if}

  {#if vm.isReconnecting}
    <p class="reconnecting" role="status">Reconnecting&hellip;</p>
  {/if}

  {#if vm.error}
    <div class="toast card" role="alert">
      <span>{vm.error.message}</span>
      <button type="button" class="dismiss" onclick={() => vm.dismissError()} aria-label="Dismiss">&times;</button>
    </div>
  {/if}

  <section class="game-view" class:dimmed={vm.isReconnecting} inert={vm.isReconnecting}>
    {#key vm.screenKey}
      <div class="screen">
        {#if route.kind === 'welcome'}
          <Welcome {manager} />
        {:else if route.kind === 'join-next-round'}
          <JoinNextRound {manager} />
        {:else if route.kind === 'phase'}
          {@const Screen = PHASE_SCREENS[route.phase].component}
          <Screen {manager} />
        {:else}
          <p class="connecting">Connecting to game server&hellip;</p>
        {/if}
      </div>
    {/key}
  </section>

  {#key vm.screenKey}
    {#if vm.banner}
      <div class="phase-banner" aria-hidden="true"><span>{vm.banner}</span></div>
    {/if}
  {/key}
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  main.tv {
    height: 100dvh;
    overflow: hidden auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 16px 8px;
  }

  .wordmark {
    position: relative;
    margin-right: auto;
    padding: 0 0.7rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--pink);
    color: var(--white);
    -webkit-text-stroke: 1.5px var(--ink);
    paint-order: stroke fill;
    box-shadow: var(--scrap-shadow);
    font-family: var(--font-display);
    font-size: var(--fs-4);
    letter-spacing: 0.05em;
    line-height: 1.6;
    text-transform: uppercase;
    transform: rotate(-2deg);
  }

  .wordmark::before {
    content: "";
    position: absolute;
    top: -9px;
    left: 50%;
    width: 44px;
    height: 16px;
    background: var(--tape-sun);
    transform: translateX(-50%) rotate(4deg);
  }

  .room-chip {
    padding: 0.1rem 0.7rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--white);
    color: var(--ink);
    font-family: var(--font-display);
    letter-spacing: 3px;
  }

  main.tv header {
    padding: 24px 40px 8px;
  }

  main.tv .wordmark {
    font-size: var(--fs-5);
  }

  main.tv .room-chip {
    font-size: var(--fs-6);
    letter-spacing: 8px;
  }

  .reconnecting {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0;
    padding: 0.5rem 1rem;
    border-bottom: var(--outline);
    background: var(--sun);
    color: var(--ink);
    font-family: var(--font-display);
    text-align: center;
  }

  .toast {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 4px 16px 0;
    padding: 0.4rem 1rem;
    background: var(--danger);
    color: var(--white);
  }

  .dismiss {
    min-width: 44px;
    min-height: 44px;
    border: none;
    background: none;
    color: inherit;
    font-size: var(--fs-4);
    cursor: pointer;
  }

  .game-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 12px 16px 24px;
    transition: opacity 0.2s;
  }

  .game-view.dimmed {
    opacity: 0.45;
  }

  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  main.tv .game-view {
    max-width: none;
    justify-content: center;
    padding: 0 60px 40px;
  }

  main.tv .screen {
    justify-content: center;
  }

  .connecting {
    text-align: center;
    padding: 40px;
  }

  .phase-banner {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
  }

  .phase-banner span {
    position: relative;
    padding: 0.4rem 2.5rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--white);
    color: var(--ink);
    box-shadow: var(--scrap-shadow);
    font-family: var(--font-display);
    font-size: calc(var(--fs-6) * var(--scale, 1));
    letter-spacing: 0.04em;
    text-align: center;
    transform: rotate(-2deg);
  }

  .phase-banner span::before {
    content: "";
    position: absolute;
    top: -14px;
    left: 50%;
    width: 90px;
    height: 26px;
    background: var(--tape-pink);
    transform: translateX(-50%) rotate(-3deg);
  }

  @keyframes banner {
    0% {
      opacity: 0;
      transform: translateX(-60vw);
    }
    18%,
    78% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(60vw);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .phase-banner {
      animation: banner 1.2s ease-out forwards;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .phase-banner {
      display: none;
    }
  }
</style>
