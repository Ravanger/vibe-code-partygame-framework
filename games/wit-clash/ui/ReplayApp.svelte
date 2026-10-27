<script lang="ts">
import { Countdown } from "@partygame/game-client";
import { ReplayViewModel, snapshotManager } from "@partygame/game-ui";
import type { PlayerSchema } from "@partygame/shared/schema";
import { WitClashState } from "../src/state.js";
import type { WitClashManager } from "./manager.js";
import { isKnownPhase, PHASE_SCREENS, type PhaseScreen } from "./screens/index.js";

/**
 * The read-only manager the phase screens get in replay mode: the snapshot's synced state plus the
 * members they touch while mounting that a static recording has no meaning for. `countdown()` is
 * rebuilt from the snapshot's own clock fields (the recorded phase is over, so it reads 0), and
 * there is no seat, so `me()` is empty and leaving is a no-op.
 */
function replayManager(viewModel: ReplayViewModel): WitClashManager {
  const base = snapshotManager(viewModel, WitClashState);
  // The adapter declares exactly the members the phase screens touch, typed like the manager's,
  // so the single assertion below is a direction TS can check without an `unknown` hop.
  return {
    isSpectator: true,
    get state(): WitClashState | undefined {
      return base.state;
    },
    me: (): PlayerSchema | undefined => undefined,
    countdown: () =>
      new Countdown(
        () => base.state.phaseEndsAt,
        () => base.state.serverNow,
      ),
    leave: async () => {},
  } as WitClashManager;
}

/** What the viewer shows right now; the template narrows on `kind`. */
type View =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "no-snapshots" }
  | {
      kind: "ready";
      model: ReplayViewModel;
      screen: PhaseScreen | undefined;
      manager: WitClashManager;
    };

let vm = $state<ReplayViewModel | undefined>(undefined);
const view = $derived.by((): View => {
  if (vm === undefined) return { kind: "empty" };
  if (vm.error !== null) return { kind: "error", message: vm.error };
  if (vm.snapshots.length === 0) return { kind: "no-snapshots" };
  const phase = vm.phase;
  return {
    kind: "ready",
    model: vm,
    screen: isKnownPhase(phase) ? PHASE_SCREENS[phase] : undefined,
    manager: replayManager(vm),
  };
});

async function onFileChange(event: Event): Promise<void> {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (file === undefined) return;
  vm = new ReplayViewModel(await file.text());
}

function togglePlay(model: ReplayViewModel): void {
  if (model.isPlaying) model.pause();
  else model.play();
}
</script>

<main class="replay">
  <header>
    <span class="wordmark">WitClash replay</span>
    <label class="open">
      Open replay bundle
      <input type="file" accept=".json,application/json" onchange={onFileChange} />
    </label>
  </header>

  {#if view.kind === "empty"}
    <p class="hint">Open a replay bundle to watch the game.</p>
  {:else if view.kind === "error"}
    <p class="error" role="alert">{view.message}</p>
  {:else if view.kind === "no-snapshots"}
    <p class="error" role="alert">The bundle has no snapshots.</p>
  {:else}
    {@const model = view.model}
    <section class="game-view">
      {#key model.index}
        {#if view.screen !== undefined}
          {@const Screen = view.screen.component}
          <Screen manager={view.manager} />
        {:else}
          {@const unknownPhase = `Unknown phase "${model.phase}"`}
          <p class="hint">{unknownPhase}</p>
        {/if}
      {/key}
    </section>

    <footer class="controls">
      <button type="button" onclick={() => model.previous()} disabled={model.index === 0}>
        Previous
      </button>
      <span class="position">{`${model.index + 1} / ${model.snapshots.length}`}</span>
      <button
        type="button"
        onclick={() => model.next()}
        disabled={model.index >= model.snapshots.length - 1}
      >
        Next
      </button>
      <button
        type="button"
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
        onchange={(event) => model.goTo(Number((event.currentTarget as HTMLInputElement).value))}
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

  .open {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.2rem 0.7rem;
    border: var(--outline);
    border-radius: var(--radius-pill);
    background: var(--white);
    font-family: var(--font-display);
    font-size: var(--fs-3);
    cursor: pointer;
  }

  .hint {
    margin: 0 auto;
    padding: 40px 24px;
    font-family: var(--font-hand);
    font-size: var(--fs-4);
    text-align: center;
  }

  .error {
    margin: 8px 16px 0;
    padding: 0.5rem 1rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--danger);
    color: var(--white);
    font-family: var(--font-display);
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

  .controls button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 0.8rem;
    border: var(--outline);
    border-radius: var(--radius-pill);
    background: var(--white);
    font-family: var(--font-display);
    cursor: pointer;
  }

  .controls button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .position {
    min-width: 4ch;
    text-align: center;
    font-family: var(--font-display);
    letter-spacing: 1px;
  }

  .controls input[type="range"] {
    flex: 1;
    accent-color: var(--pink);
  }
</style>
