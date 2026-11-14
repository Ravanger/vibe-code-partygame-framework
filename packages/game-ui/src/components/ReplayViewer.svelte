<script lang="ts" generics="TState extends BaseGameState">
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import type { Component } from "svelte";
import { type ReplayManager, ReplayViewModel, replayManager } from "../ReplayViewModel.svelte.js";

/**
 * A phase screen as the viewer sees it. `manager` is typed `never` so a screen expecting the
 * game's full manager still fits; at render time the viewer passes a `ReplayManager<TState>`
 * adapter instead (an unchecked cast, so a screen may only read what that interface provides).
 */
type ReplayScreen = { component: Component<{ manager: never }> };

const { screens, stateClass, title }: {
  /** Phase name to screen table — the same shape as the game's `PHASE_SCREENS`. */
  screens: Record<string, ReplayScreen>;
  /** The game's synced state class; each snapshot is hydrated into a fresh instance. */
  stateClass: new () => TState;
  /** The wordmark in the header; its face is themed by the game's `header .wordmark` rule. */
  title: string;
} = $props();

/** What the viewer shows right now; the template narrows on `kind`. */
type View =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "no-snapshots" }
  | {
      kind: "ready";
      model: ReplayViewModel;
      screen: { component: Component<{ manager: ReplayManager<TState> }> } | undefined;
      manager: ReplayManager<TState>;
    };

let vm = $state<ReplayViewModel | undefined>(undefined);
const view = $derived.by((): View => {
  if (vm === undefined) return { kind: "empty" };
  if (vm.error !== null) return { kind: "error", message: vm.error };
  if (vm.snapshots.length === 0) return { kind: "no-snapshots" };
  const phase = vm.phase;
  // The adapter declares exactly the members the phase screens touch; narrowing a screen typed
  // for the game's full manager to it is unchecked.
  const entry = screens[phase];
  const screen =
    entry === undefined
      ? undefined
      : (entry as { component: Component<{ manager: ReplayManager<TState> }> });
  return { kind: "ready", model: vm, screen, manager: replayManager(vm, stateClass) };
});

async function onFileChange(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (file === undefined) return;
  vm = new ReplayViewModel(await file.text());
  // Clear the selection so re-picking the same file fires change again.
  input.value = "";
}

function togglePlay(model: ReplayViewModel): void {
  if (model.isPlaying) model.pause();
  else model.play();
}
</script>

<main>
  <header>
    <span class="wordmark">{title}</span>
    <label class="btn">
      Open replay bundle
      <input type="file" accept=".json,application/json" onchange={onFileChange} />
    </label>
  </header>

  {#if view.kind === "empty"}
    <p class="hint hand">Open a replay bundle to watch the game.</p>
  {:else if view.kind === "error"}
    <p class="notice notice--danger" role="alert">{view.message}</p>
  {:else if view.kind === "no-snapshots"}
    <p class="notice notice--danger" role="alert">The bundle has no snapshots.</p>
  {:else}
    {@const model = view.model}
    <section class="game-view">
      {#key model.index}
        {#if view.screen !== undefined}
          {@const Screen = view.screen.component}
          <Screen manager={view.manager} />
        {:else}
          {@const unknownPhase = `Unknown phase "${model.phase}"`}
          <p class="hint hand">{unknownPhase}</p>
        {/if}
      {/key}
    </section>

    <footer class="controls">
      <button
        type="button"
        class="btn"
        onclick={() => model.previous()}
        disabled={model.index === 0}
      >
        Previous
      </button>
      <span class="position">{`${model.index + 1} / ${model.snapshots.length}`}</span>
      <button
        type="button"
        class="btn"
        onclick={() => model.next()}
        disabled={model.index >= model.snapshots.length - 1}
      >
        Next
      </button>
      <button
        type="button"
        class="btn"
        aria-pressed={model.isPlaying}
        disabled={model.index >= model.snapshots.length - 1}
        onclick={() => togglePlay(model)}
      >
        {model.isPlaying ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min="0"
        max={model.snapshots.length - 1}
        step="1"
        value={model.index}
        aria-label="Replay position"
        oninput={(event) => model.goTo(Number((event.currentTarget as HTMLInputElement).value))}
      />
    </footer>
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 16px 8px;
  }

  /* The wordmark face (font, tape) is themed by the game's global `header .wordmark` rule. */
  .wordmark {
    margin-right: auto;
  }

  .hint {
    margin: 0 auto;
    padding: 40px 24px;
    font-size: var(--fs-4);
    text-align: center;
  }

  .notice {
    margin: 8px 16px 0;
  }

  .game-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 12px 16px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 12px 16px 24px;
    border-top: var(--outline);
  }

  .position {
    min-width: 4ch;
    text-align: center;
    font-family: var(--font-display);
    letter-spacing: 1px;
  }

  .controls input[type="range"] {
    flex: 1;
    accent-color: var(--accent);
  }
</style>
