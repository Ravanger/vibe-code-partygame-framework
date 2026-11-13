<script lang="ts" generics="TState extends BaseGameState, TScreens extends Readonly<Record<string, RouterScreen>>">
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import type { Snippet } from "svelte";
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { AppRouter, RouterScreen } from "../AppRouter.js";
import type { GameControlsViewModel } from "../GameControlsViewModel.svelte.js";
import GameControls from "./GameControls.svelte";

const {
  router,
  controls,
  headingSelector = ".screen h1, .screen h2",
  wordmark,
  welcome,
  joinNextRound,
  phase,
}: {
  router: AppRouter<TState, TScreens>;
  controls: GameControlsViewModel<TState>;
  headingSelector?: string;
  wordmark: Snippet;
  welcome: Snippet;
  joinNextRound: Snippet;
  phase: Snippet<[keyof TScreens & string]>;
} = $props();

let lastScreenKey: string | null = null;
let root: HTMLElement | undefined;

$effect(() => {
  const key = router.screenKey;
  if (key === lastScreenKey) return;
  const first = lastScreenKey === null;
  lastScreenKey = key;
  if (first) return;
  // a form field that just mounted takes its own focus; don't steal it
  if (document.activeElement?.matches("input, textarea, select")) return;
  const heading = root?.querySelector<HTMLElement>(headingSelector);
  if (!heading) {
    root?.querySelector<HTMLElement>(".screen")?.focus();
    return;
  }
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
  heading.focus();
});

const route = $derived(router.screen);
</script>

<main bind:this={root} class:tv={router.isSpectator}>
  <p class="sr-only" role="log" aria-live="polite" aria-label="Phase updates">{router.banner}</p>
  {#if route.kind !== "welcome"}
    <header>
      <span class="wordmark">{@render wordmark()}</span>
      <span class="room-chip">{router.roomCode}</span>
      <GameControls vm={controls} />
    </header>
  {/if}

  {#if router.isReconnecting}
    <p class="reconnecting" role="status">Reconnecting&hellip;</p>
  {/if}

  {#if router.error}
    <div class="toast card" role="alert">
      <span>{router.error.message}</span>
      <button type="button" class="dismiss" onclick={() => router.dismissError()} aria-label="Dismiss">&times;</button>
    </div>
  {/if}

  <section class="game-view" class:dimmed={router.isReconnecting} inert={router.isReconnecting}>
    {#key router.screenKey}
      <div class="screen" tabindex="-1">
        {#if route.kind === "welcome"}
          {@render welcome()}
        {:else if route.kind === "join-next-round"}
          {@render joinNextRound()}
        {:else if route.kind === "phase"}
          {@render phase(route.phase)}
        {:else}
          <p class="connecting">Connecting to game server&hellip;</p>
        {/if}
      </div>
    {/key}
  </section>

  {#key router.screenKey}
    {#if router.banner}
      <div class="phase-banner" aria-hidden="true"><span>{router.banner}</span></div>
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
    margin-right: auto;
  }

  main.tv header {
    /* viewport-relative so the wordmark and room chip stay out of the outer 5% overscan band */
    padding: 7vh 7vw 8px;
  }

  .reconnecting {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0;
    padding: 0.5rem 1rem;
    border-bottom: var(--outline);
    background: var(--color-2);
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
    /* never grow past the viewport: screens must fit, not push an internal scrollbar */
    min-height: 0;
    /* viewport-relative so the content stays out of the outer 5% overscan band at any TV resolution */
    padding: 0 7vw 6vh;
  }

  main.tv .screen {
    justify-content: center;
    min-height: 0;
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
    .game-view {
      transition: opacity 0.2s;
    }

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
