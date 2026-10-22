# @partygame/game-ui

Svelte 5 viewmodels (no UI code) and reusable components for game screens.

Ships Svelte source; consumers need the Svelte plugin — Vite with `@sveltejs/vite-plugin-svelte`, or the vitest preset that aliases to source.

| Import | What |
|---|---|
| `@partygame/game-ui` | `createAppRouter`, `AppRouter`, `WelcomeViewModel`, `WaitingRoomViewModel`, `LobbySettingsViewModel`, `OptionsReader`, `PhaseClock`, `TypingReporter`, `GameControlsViewModel`, `NameField`, `ReplayViewModel`, `snapshotManager`; `OptionFields`, `qrCode`, `playerSticker`, `rankRows`, `podiumSteps` |
| `@partygame/game-ui/components` | Svelte 5 source: `StatusPanel`, `Timer`, `PlayerSticker`, `QrCode`, `ActionBar`, `NameInput`, `LobbySettings`, `GameControls`, `Podium` |

Viewmodels are typed on `GameConnectionManager<TState>` and read its state reactively. Import through the `svelte` export condition (Vite with the Svelte plugin). Build one in a component with `untrack(() => new Vm(manager))`.

## Route screens

`createAppRouter(manager, screens)` maps each phase name to your component and an optional `banner`. `router.screen` is a `Route`: `welcome` (not connected), `connecting` (phase missing from the table), `join-next-round` (inactive seat outside the lobby) or `phase`. A client with no seat (the TV) gets the phase screen.

```svelte
<script lang="ts">
  import { createAppRouter } from "@partygame/game-ui";
  import { LOBBY_PHASE } from "@partygame/shared";
  import Lobby from "./Lobby.svelte";
  import Round from "./Round.svelte";
  import Welcome from "./Welcome.svelte";
  import { manager } from "./manager.js";

  const SCREENS = {
    [LOBBY_PHASE]: { component: Lobby, banner: "" },
    Round: { component: Round, banner: "GO!" },
  };
  const router = createAppRouter(manager, SCREENS);
  const route = $derived(router.screen);
</script>

{#if route.kind === "phase"}
  {@const Screen = SCREENS[route.phase].component}
  <Screen {manager} />
{:else if route.kind === "welcome"}
  <Welcome {manager} />
{:else}
  <p>Connecting...</p>
{/if}
```

The router also exposes `banner`, `phase`, `isSpectator`, `isReconnecting`, `roomCode`, `error`, `dismissError()`.

## Welcome and waiting room

`WelcomeViewModel(manager, urlCode?, urlTvCode?)` hosts, joins by code, watches as a TV and auto-joins from a share link. `WaitingRoomViewModel(manager, browser?)` is the lobby: `players`, `readyCount`, `canStart`, `start()`, kick, `nameField`, `shareUrl`, `notice`. `browser` injects `location()` (for `shareUrl`) and `clipboard.writeText` (for the copy button); both default to the page's globals, read lazily.

```svelte
<script lang="ts">
  import { readCodeParam, type GameConnectionManager } from "@partygame/game-client";
  import { WelcomeViewModel } from "@partygame/game-ui";
  import { untrack } from "svelte";

  const { manager }: { manager: GameConnectionManager<ButtonState> } = $props();
  const vm = untrack(
    () => new WelcomeViewModel(manager, readCodeParam(location.search, "code"), readCodeParam(location.search, "tv")),
  );
  $effect(() => { void vm.autoJoinIfRequested(); });
</script>

<input value={vm.code} oninput={(e) => vm.setCode(e.currentTarget.value)} />
<button type="button" disabled={!vm.codeIsValid || vm.busy} onclick={() => vm.join()}>Join</button>
```

Build the waiting room the same way and call `vm.destroy()` on teardown: `$effect(() => () => vm.destroy())`.

## Settings from your options schema

`LobbySettingsViewModel` takes the zod schema you pass to `defineGame`. Every bounded numeric option becomes a labelled number input for the host and a read-only line for everyone else; every string-enum option becomes a row of choice buttons, one per value (a commit that is not one of them is dropped without sending); `labels` overrides the generated names.

```ts
import type { GameConnectionManager } from "@partygame/game-client";
import { LobbySettingsViewModel as Base } from "@partygame/game-ui";

export class LobbySettingsViewModel extends Base<ButtonState> {
  constructor(manager: GameConnectionManager<ButtonState>) {
    super(manager, { schema: ButtonOptionsSchema, defaults: { turnSeconds: 20 } });
  }
}
```

Any viewmodel that needs the published options reads them through `OptionsReader`: `new OptionsReader(manager, schema, defaults?)` parses `state.options` once per change and exposes `current` (reactive), falling back to `defaults` or the schema's own `.default()`s when nothing valid is published.

`GameControlsViewModel(manager, isGameOver?)` is leave plus a host-only end-game menu outside the lobby; subclass it with `super(manager, (state) => state.phase === "Done")`.

## Phase clock and typing

`PhaseClock(manager, totalSeconds, announceAt?)` wraps `manager.countdown()`: `secondsLeft`, `isUrgent` (the last ten seconds), `announcement` ("N seconds remaining" at 30/10/5 by default) and your `totalSeconds` getter — e.g. `() => options.current.promptSeconds` from an `OptionsReader`.

`TypingReporter(send, idleMs = 2500)` calls `send(true)` on the first keystroke and `send(false)` after `idleMs` of quiet or on `stop()` — one message per change. Call `keystroke()` per key and `stop()` on submit or teardown.

## Replay viewer

`ReplayViewModel(bundleText, { intervalMs?, timer? })` loads a replay bundle file (the JSON the host exports) and steps through its snapshots as a read-only spectator — no game runtime, no server connection. `snapshots`, `index`, `current` (the snapshot's synced state as plain JSON) and `phase` are reactive; `next()`, `previous()` and `goTo(i)` clamp at the ends. A file that is not valid JSON, not a bundle of the supported format version, or with malformed snapshots sets `error` and leaves no snapshots. `play()`/`pause()` auto-advance every `intervalMs` (default 1000) on an injectable timer, stopping at the last snapshot.

`snapshotManager(viewModel, stateClass)` adapts a viewmodel to the shape screens read from a `GameConnectionManager`: `state` is a fresh `stateClass` instance filled from the current snapshot, and `isSpectator` is always true — so an existing screen can render a replay read-only. Snapshots hold synced state only (never private or per-client data), and the bundle must come from this framework's exporter.

```svelte
<script lang="ts">
  import { ReplayViewModel, snapshotManager } from "@partygame/game-ui";
  import { untrack } from "svelte";

  const vm = untrack(() => new ReplayViewModel(bundleText)); // the bundle file's contents
  const manager = $derived(snapshotManager(vm, ButtonState));
</script>

{#if vm.error}
  <p>{vm.error}</p>
{:else}
  <Round {manager} />
  <button type="button" onclick={() => vm.previous()}>Back</button>
  <button type="button" onclick={() => vm.next()}>Next</button>
{/if}
```

## Components

Props (all render in plain markup, e.g. `<Timer seconds={12} total={30} />`): `LobbySettings` and `GameControls` take `vm`; `NameInput` takes `field` (`vm.nameField`) and `focus?`; `PlayerSticker` takes `name`, `playerId`, `size?`, `ghost?`; `QrCode` takes `text`; `StatusPanel` takes `title`, `detail?`, `tone` (`"wait"`, `"done"`, `"info"`); `Timer` takes `seconds`, `total`, `announcement?`.

## Podium and ranking

`rankRows` adds competition ranks (1, 1, 3) to rows in leaderboard order; `podiumSteps` keeps the top three rank groups among seated rows; `Podium` takes `steps` and an optional `extra` snippet per occupant.

```svelte
<script lang="ts">
  import { podiumSteps, rankRows, type PodiumRow } from "@partygame/game-ui";
  import { Podium } from "@partygame/game-ui/components";

  const { rows }: { rows: Omit<PodiumRow, "rank">[] } = $props(); // best first
  const steps = $derived(podiumSteps(rankRows(rows)));
</script>

<Podium {steps}>
  {#snippet extra(row)}<span class="chip">{row.score}</span>{/snippet}
</Podium>
```

## Theme

No stylesheet ships; the components read your CSS.

- Custom properties: `--ink`, `--ink-soft`, `--white`, `--paper`, `--pink`, `--sun`, `--mint`, `--sky`, `--disabled`, `--tape-sky`, `--tape-mint`, `--fs-1` to `--fs-5`, `--font-display`, `--outline`, `--radius-card`, `--radius-btn`, `--scrap-shadow`; optional `--scale` (default 1) and `--timer-size` (default 96px).
- Global classes: `card`, `taped`, `sticker`, `hand`, `sr-only`, `btn` (`btn--ghost`, `btn--danger`); `action-bar` is rendered by `ActionBar`, which styles nothing.

Depends on: `@partygame/game-client`, `@partygame/shared`

Guide: [docs/framework/README.md#game-ui-viewmodels](../../docs/framework/README.md#game-ui-viewmodels) ([Components](../../docs/framework/README.md#components))
