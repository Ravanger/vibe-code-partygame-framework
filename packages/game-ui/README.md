# @partygame/game-ui

Svelte 5 viewmodels (no UI code) and reusable components for game screens.

Ships Svelte source; consumers need the Svelte plugin — Vite with `@sveltejs/vite-plugin-svelte`, or the vitest preset that aliases to source.

| Import | What |
|---|---|
| `@partygame/game-ui` | `createAppRouter`, `AppRouter`, `WelcomeViewModel`, `WaitingRoomViewModel`, `LobbySettingsViewModel`, `OptionsReader`, `PhaseClock`, `TypingReporter`, `GameControlsViewModel`, `JoinNextRoundViewModel`, `NameField`, `ReplayViewModel`, `snapshotManager`, `SoundPolicy`, `Spotlight`, `TextDraft`; `OptionFields`, `qrCode`, `playerSticker`, `rankRows`, `leaders`, `podiumSteps`, `roundLabel`, `plural`; `setStrings`, `defaultUiStrings`, `UiStrings`; types `RouterScreen`, `LobbySettingsConfig`, `SoundPolicyOptions`, `StickerShape`, `TextDraftConfig`, `ProgressRow` |
| `@partygame/game-ui/components` | Svelte 5 source: `GameShell`, `WelcomeScreen`, `StatusPanel`, `Timer`, `PhaseTimer`, `PhaseBar`, `PlayerSticker`, `QrCode`, `ActionBar`, `NameInput`, `SoundToggle`, `LobbySettings`, `GameControls`, `Podium`, `Confetti`, `ScreenTitle`, `ProgressStrip`, `ChoiceBoard` |
| `@partygame/game-ui/testing` | Test-only CSS audits for a game's `ui/` directory: `auditContrast({ uiDir, minChecked, pairs? })` (WCAG AA over same-rule colour/background pairs plus explicit cross-rule pairs; fails on a colour variable defined nowhere and throws when fewer than `minChecked` pairs were checked), `auditReducedMotion({ uiDir, minGuarded, allow? })` (every transition/animation/`scroll-behavior: smooth` inside a no-preference block, no Svelte motion directives outside the allow list; throws below `minGuarded`) and the walkers `cssFiles`, `rules`, `stripComments` |

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

A `RouterScreen` is one entry of that table: `component` and an optional `banner`. The router also exposes `banner`, `phase`, `isSpectator`, `isReconnecting`, `roomCode`, `error`, `dismissError()`.

## App shell

`GameShell` (from `@partygame/game-ui/components`) is the chrome every screen sits in: the header (wordmark, room code, `GameControls`), a reconnecting bar that dims and `inert`s the game view, a dismissible error toast, the routed screen inside `.screen`, and the phase banner. Pass your router and controls, and give it one snippet per route kind — `welcome`, `joinNextRound`, `phase(phase)` (the phase name, for indexing your own screen table) and `wordmark`:

```svelte
<script lang="ts">
  import { GameControlsViewModel, createAppRouter } from "@partygame/game-ui";
  import { GameShell } from "@partygame/game-ui/components";
  import { untrack } from "svelte";
  import JoinNextRound from "./screens/JoinNextRound.svelte";
  import { PHASE_SCREENS } from "./screens/index.js";
  import Welcome from "./screens/Welcome.svelte";

  const { manager }: { manager: GameConnectionManager<ButtonState> } = $props();
  const router = untrack(() => createAppRouter(manager, PHASE_SCREENS));
  const controls = untrack(() => new GameControlsViewModel(manager, isGameOver));
</script>

<GameShell router={router} controls={controls}>
  {#snippet wordmark()}MyGame{/snippet}
  {#snippet welcome()}<Welcome {manager} />{/snippet}
  {#snippet joinNextRound()}<JoinNextRound {manager} />{/snippet}
  {#snippet phase(phase)}
    {@const Screen = PHASE_SCREENS[phase].component}
    <Screen {manager} />
  {/snippet}
</GameShell>
```

On every screen change (never on the initial mount) it moves focus to the first heading matching `headingSelector` (default `.screen h1, .screen h2`) inside the new screen — unless a form field that just mounted already took its own focus — sets `tabindex="-1"` on a heading that lacks one, and falls back to focusing the `.screen` container when no heading matches. The focused heading and the polite live region are both announced by design: the heading names the screen, the banner announces the phase moment.

The shell renders structure; it carries no game look. Its stable class names — `header`, `.wordmark`, `.room-chip`, `.reconnecting`, `.game-view`, `.screen`, `.phase-banner` — are styled by global rules in your `app.css` (a component's scoped `<style>` cannot reach the snippet content you pass it). Keep those rules in ascending specificity order, e.g. `.screen .wordmark` before `main.tv header .wordmark`.

`WelcomeScreen` is the entry screen: a wordmark `title` and `tagline` (or a `hero` snippet replacing both), the host button, a join-by-code input, a watch-on-a-TV button and a dismissible local error. It owns the `$effect(() => { void vm.autoJoinIfRequested(); })`, so share links (`?code=`) and TV links (`?tv=`) connect without a click:

```svelte
<script lang="ts">
  import { readUrlCode, readUrlTvCode } from "@partygame/game-client";
  import { WelcomeViewModel } from "@partygame/game-ui";
  import { WelcomeScreen } from "@partygame/game-ui/components";
  import { untrack } from "svelte";

  const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));
</script>

<WelcomeScreen vm={vm} title="MyGame" tagline="One line about the game." />
```

The wordmark face (font, tape) is themed by your global `.screen .wordmark` rule.

## Welcome and waiting room

`WelcomeViewModel(manager, urlCode?, urlTvCode?)` hosts, joins by code, watches as a TV and auto-joins from a share link. `WaitingRoomViewModel(manager, browser?)` is the lobby: `players`, `readyCount`, `canStart`, `start()`, kick, `nameField`, `shareUrl`, `notice`. `browser` injects `location()` (for `shareUrl`) and `clipboard.writeText` (for the copy button); both default to the page's globals, read lazily. Also on `WaitingRoomViewModel`: `needsName` (this seat is not yet named), `draftName` (the name as typed), `showJoinInfo` (room code and share link: host and spectators), `showWaitingPanel` (a named non-host waits for the host), `copyCode()` plus `copyState` (`"idle"` / `"copied"` / `"failed"` — a success shows `"copied"` for 2000 ms, a denied or missing clipboard shows `"failed"` until the next attempt) and `copyStatusText` (the table's text for the current state, empty while idle — render it in an `aria-live="polite"` element next to your copy button so screen readers hear the outcome), `canKick(player)` (host, any other seat), `askKick(id)`, `confirmKick()` (sends `KICK_PLAYER`, host only) and `cancelKick()`.

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

`LobbySettingsViewModel` takes the zod schema you pass to `defineGame`. Every bounded numeric option (`.min()` and `.max()`) becomes a labelled number input for the host — step 1 for integers, the schema's `multipleOf` when present, else `any` — and a read-only line for everyone else; every boolean option becomes a checkbox; every string-enum option becomes a row of choice buttons, one per value (a commit that is not one of them is dropped without sending); every plain string option becomes a text input, bounded by `maxlength` when the schema bounds it. Options the form cannot render (unbounded numbers, arrays, objects, enums with non-string choices) are skipped and reported to the optional `onUnsupported(key, reason)` config — by default a console warning, once per key per instance; `labels` overrides the generated names, and the optional `choiceLabels` (`{ fieldKey: { rawValue: "Label" } }`) renames a select field's choice buttons and its read-only line without touching what gets committed (an unlisted choice keeps its raw value). Once a commit resolves — accepted or rejected — the field shows what the server published, so a normalised value and later changes are never hidden by local typing; if the server publishes a new value for a key while an older draft lingers, that draft is dropped (the typed value keeps showing while its own commit is in flight). The config type is `LobbySettingsConfig` (what the view model needs to build the form from the options schema). Members: `canEdit` (host only), `startsOpen` (panel starts expanded for host and spectators) and `setDraft(key, raw)` (stores what the host is typing without sending; `commit` sends it).

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

`GameControlsViewModel(manager, isGameOver?)` is leave plus a host-only end-game menu outside the lobby; subclass it with `super(manager, (state) => state.phase === "Done")`. Members: `isVisible` (connected and outside the lobby), `canEndGame` (host, controls visible, game not over), `toggleMenu()`/`closeMenu()` (both drop a pending end confirmation), `askEnd()`, `confirmEnd()` (closes the menu and sends `END_GAME`; no-op unless `canEndGame`) and `cancelEnd()`.

`JoinNextRoundViewModel(manager, screens)` is the base for the screen a late joiner sees while waiting for their first round or game: `needsName` (the seat has no confirmed name yet), `heading`, `hint`, `phaseLabel` (the current phase's screen `waitingLabel`, or the raw phase name when it has none) and `nameField`; call `destroy()` on teardown. Subclass it with `super(manager, PHASE_SCREENS)` to add game-specific content (a scoreboard, a round label) and override `heading`/`hint`.

## Phase clock and typing

`PhaseClock(manager, totalSeconds, announceAt?)` wraps `manager.countdown()`: `secondsLeft`, `isUrgent` (the last ten seconds), `announcement` ("N seconds remaining" at 30/10/5 by default), `fraction` (the share of the phase still running, 0 to 1) and your `totalSeconds` getter — e.g. `() => options.current.promptSeconds` from an `OptionsReader`.

`roundLabel(round, total)` is the shared "Round 2 of 3" label for round-based screens; pass it the state's `roundNumber` and `totalRounds` (zeros before the first round).

`TypingReporter(send, idleMs = 2500)` calls `send(true)` on the first keystroke and `send(false)` after `idleMs` of quiet or on `stop()` — one message per change. Call `keystroke()` per key and `stop()` on submit or teardown.

## Spotlight and confetti

`Spotlight(count, periodMs = 8000)` cycles a reactive `current` index through `count()` panels every `periodMs`, wrapping around; while `count() <= 1` it stays at zero (`isActive` is false). Call `destroy()` when the screen unmounts. Use it to alternate what a results screen shows (e.g. podium vs best answers for spectators):

```ts
const spotlight = new Spotlight(() => (isSpectator && bestAnswers.length > 0 ? 2 : 1));
// show panel one while spotlight.current === 1 and spotlight.isActive
$effect(() => () => spotlight.destroy());
```

`Confetti` (from `@partygame/game-ui/components`) rains `count` deterministic pieces from the top of the screen, coloured by the theme palette (`--color-1` to `--color-4`, `--accent`); the pieces are hidden and the fall animation runs only under `prefers-reduced-motion: no-preference`. Render it inside an `{#if}` so it exists only while celebrating.

## Text draft

`TextDraft(manager, config)` holds the shared rules of a free-text answer field: one draft per key (`draft(key)`, `setDraft(key, value)`), `charsRemaining(key)` and `canSubmit(key)` (non-blank and within `config.maxLength`), `rejectionReason` (the server's message for a `CONTENT_REJECTED` error, else "") and `moderationLine` — host only, hidden while the filter level is "off", e.g. "3 answers rejected, level moderate" (`config.noun` is the singular noun, pluralised by appending "s"). `config.filterLevel()` and `config.rejectedCount()` are getters into your state, so the class stays game-agnostic; a screen with one field uses one key, a screen with several fields uses one key per field.

## Sound

`SoundPolicy({ storage, storagePrefix, target })` (`SoundPolicyOptions`: where the toggle persists and where the first gesture is heard) is the room's sound gate: off by default, one persisted toggle, and nothing plays before the first tap (browsers block audio until a user gesture, and players on a shared TV may not want it). `enabled` (persisted under `${storagePrefix}.sound`; a throwing or empty storage — private windows — degrades to off), `unlocked` (a pointerdown or keydown on `target` has happened) and `canPlay` (both) are reactive getters; `toggle()` flips `enabled`; `dispose()` removes the gesture listeners when the owning screen unmounts. Construct it once with the page's globals, using the same prefix you pass to `GameConnectionManager`:

```ts
import { SoundPolicy } from "@partygame/game-ui";

const sound = new SoundPolicy({ storage: localStorage, storagePrefix: "my-game", target: window });
```

`SoundToggle` (from `@partygame/game-ui/components`) is the button for it — a native `type="button"` with a constant label and `aria-pressed`, so a screen reader announces one state ("Sound, pressed") instead of a contradicting pair; the label comes from the `UiStrings` table (`sound`, default "Sound"), and the button has a 44px minimum height. Gate every sound your game makes on `canPlay`; combined with a feedback bus of sound events, that is one line per event:

```svelte
<script lang="ts">
  import { SoundPolicy } from "@partygame/game-ui";
  import { SoundToggle } from "@partygame/game-ui/components";

  const sound = new SoundPolicy({ storage: localStorage, storagePrefix: "my-game", target: window });

  // the game's audio player (a stub here); the bus emits events like "tick" or "fanfare"
  const play = (name: string): void => {
    /* WebAudio, Howler, ... */
  };

  // one line per event: play only when allowed
  const onSound = (name: string): void => {
    if (sound.canPlay) play(name);
  };
</script>

<SoundToggle policy={sound} />
```

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

Props (all render in plain markup, e.g. `<Timer seconds={12} total={30} />`): `LobbyScreen` takes `vm` (`WaitingRoomViewModel`) and optionally `settings` (`LobbySettingsViewModel`, rendered below the players) and an `extra` snippet; it renders notice, name card (first while unnamed), room code with copy button and QR for host and spectators, the waiting panel for named guests, the player list with badges and kick confirmation, leave and — for the host — the start button; the chips (`chip`, `chip--sky`, `chip--paper`) are styled by the game. `LobbySettings` and `GameControls` take `vm`; `NameInput` takes `field` (`vm.nameField`) and `focus?`; `PlayerSticker` takes `name`, `playerId`, `size?`, `ghost?`; `QrCode` takes `text`; `SoundToggle` takes `policy` (a `SoundPolicy`); `StatusPanel` takes `title`, `detail?`, `tone` (`"wait"`, `"done"`, `"info"`); `Timer` takes `seconds`, `fraction` (0 to 1, from `PhaseClock.fraction`) and `announcement?`; `PhaseTimer` and `PhaseBar` take a `clock` (`PhaseClock`) — `PhaseTimer` renders the `Timer` from the clock's seconds, fraction and announcement, and `PhaseBar` renders a "next up in Ns" label over a draining track. `ScreenTitle` takes `title` and an optional `hint`: a focusable heading (the `h1` carries `tabindex="-1"`) with a wavy underline. `ProgressStrip` takes `rows` (`ProgressRow[]`) and a required `label`, the strip's accessible name; each row shows its sticker, name, an `answered/expected` count and — from `UiStrings` — the done mark or the typing mark and label. `ChoiceBoard` takes `choices` (objects with `id`, `text` and optional `picked`, `own`, `label`), `canVote`, `onvote(id)` and an optional `versus` string rendered as a divider before the second choice; the picked choice is marked with a stamp and `aria-pressed`, the own one stays disabled with its chip, and a switch hint shows while the pick can still change. `DraftBox` takes `value`, `label` (the textarea's accessible name), `maxLength`, `remaining`, `oninput(value)`, `onsubmit()`, an optional `placeholder` and an optional `rejection`: Enter submits (Shift+Enter inserts a newline; the textarea carries `enterkeyhint="send"`), a counter chip shows `charsLeft(remaining)` from `UiStrings` and turns low below 20, and a non-empty `rejection` renders as a `role="alert"` line above the box.

## Podium and ranking

`STICKER_SHAPES` lists the shapes a player sticker can take (`StickerShape` is one of them). `rankRows` adds competition ranks (1, 1, 3) to rows in leaderboard order; `leaders` picks the seated rank-1 rows — empty when the list is empty or the top score is 0, so a leaver tied on score never counts as a co-leader; `podiumSteps` keeps the top three rank groups among seated rows; `Podium` takes `steps` and an optional `extra` snippet per occupant. The place on each block comes from the `UiStrings.podiumPlace(tier)` table entry (default "1st"/"2nd"/"3rd"), so it can be translated; `PodiumStep.label` keeps the English default for uses that render steps without the component. Block heights come from `--podium-block-height-1` to `--podium-block-height-3` (the contract's fallbacks are scaled by `--scale`); set them in your own context for a different scale, e.g. inside a `main.tv` rule.

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

## Localisation

Every label the generic components render (the GameControls menu and dialog, the LobbyScreen — room code, badges, kick confirmation and start button, several through function entries such as `playersHeading(ready, min, max)` and `startGame(ready, min)` —, the LobbySettings summary, NameInput, Podium — places through its `podiumPlace(tier)` function entry —, QrCode, the SoundToggle label, the StatusPanel and ProgressStrip done mark (`done`), the ProgressStrip typing label (`typing`), the ChoiceBoard stamp (`pickedStamp`), switch hint (`switchHint`) and own-item chip (`yours`), the DraftBox counter through its `charsLeft(n)` function entry, the waiting room's copy status (`codeCopied`, `codeCopyFailed`), the `PhaseClock` announcement through its `secondsRemaining(n)` function entry and the PhaseBar label through its `nextUpIn(n)` function entry) comes from `defaultUiStrings`. Call `setStrings(partial)` once at the app root to replace any of them; unspecified keys keep the English default.

```svelte
<script lang="ts">
  import { setStrings } from "@partygame/game-ui";

  setStrings({ leaveGame: "Spiel verlassen", secondsRemaining: (n) => `Noch ${n} Sekunden` });
</script>
```

The table also carries a `clientStrings` field (`Partial<ClientStrings>` from `@partygame/game-client`): pass the same object to both the manager's `strings` option and `setStrings`, and one table localises both layers. Server error text resolves as `clientStrings.errors[code] ?? message`, so codes you do not translate keep the server's own message.

## Theme

The package ships two stylesheets. `theme-contract.css` is a baseline for every contract variable (the `CONTRACT_VARIABLES` list in `src/themeContract.ts`), the `main.tv` base sizes for TV displays and the `.sr-only` utility; `base.css` is the look every framework component needs — page baseline, cards, tape, chips, stickers, buttons, notices, the hand font class and the reduced-motion guards — all on those tokens. Import both at the top of your game's `app.css`, then override any variable you want to change:

```css
@import "@partygame/game-ui/theme-contract.css";
@import "@partygame/game-ui/base.css";
```

- Custom properties: `--ink`, `--ink-soft`, `--white`, `--paper`, `--color-1` to `--color-4`, `--accent`, `--danger`, `--disabled`, `--tape-1` to `--tape-4`, `--fs-1` to `--fs-6`, `--font-display`, `--font-hand`, `--font-body`, `--outline`, `--radius-card`, `--radius-btn`, `--radius-pill`, `--scrap-shadow`, `--podium-block-height-1`, `--podium-block-height-2`, `--podium-block-height-3`, `--scale`, `--timer-size`, `--screen-pad-x`, `--screen-pad-y`.
- TV displays: the `main.tv` rule sets `--scale: 1.6` (every `calc(var(--fs-*) * var(--scale, 1))` declaration scales with it), lifts `--fs-1` to the 24px minimum and raises the base font size; games may further tune `--podium-block-height-*` in their own `main.tv` rule.
- Sticker colours: `PlayerSticker` sets `data-color` to a palette index (0–3); the contract maps `[data-color="0"]` to `--color-1` through `[data-color="3"]` to `--color-4`.
- Global classes: `card`, `taped`, `sticker`, `hand`, `chip` and its variants, the `btn` family, `notice`, `sr-only` ship with the stylesheets; the game still defines the app-shell faces `wordmark` and `room-chip`. `ActionBar` styles its own bar (hidden on TV displays).
- Chrome vs artwork: chrome — the framework components' look (lobby, join overlays, scoreboard/podium, game controls, timer) — is themed through these variables; artwork — your screens and cards — is yours to design.

## Accessibility

Every component is checked by axe in the jsdom tests via `expectNoViolations(container, "Component")` from `tests/support/a11y.ts`; zero violations is the gate. `color-contrast` is disabled there because jsdom cannot compute it — contrast stays a game-level test (the `auditContrast` below). Interactive components are also driven with `userEvent` for tab order and Escape handling, and `tests/reducedMotion.test.ts` fails on any `transition`/`animation` declaration outside an `@media (prefers-reduced-motion: no-preference)` block.

A violation that cannot be fixed yet goes into `tests/support/a11yAllowList.ts`: one entry per rule and component, each with a comment explaining why it is acceptable and the issue that tracks the fix.

## Testing (CSS audits)

`@partygame/game-ui/testing` audits a game's `ui/` directory from its test suite — every game with a `ui/` runs both:

```ts
import { auditContrast, auditReducedMotion } from "@partygame/game-ui/testing";

const report = auditContrast({ uiDir: UI_DIR, minChecked: 17 });
expect(report.unresolved).toEqual([]);
expect(report.failures).toEqual([]);
```

- `auditContrast({ uiDir, minChecked, pairs? })` checks WCAG AA for every same-rule `color`/`background` pair (4.5:1, or 3:1 when the font size statically resolves to at least 24px — 18.66px bold); a pair that only reaches the large-text ratio with an unresolvable size fails. Tokens come from the theme contract plus every `:root` block under `uiDir`. A `color` or `background` naming a custom property defined nowhere lands in `report.unresolved` (file, selector and variable); a variable assigned in some rule — e.g. a per-card `--tape` — is not "nowhere". `pairs` adds cross-rule checks by selector (`{ color: ".fg", background: ".bg" }`, first resolvable match wins). It throws when fewer than `minChecked` same-rule pairs were checked, so the audit cannot pass vacuously.
- `auditReducedMotion({ uiDir, minGuarded, allow? })` fails on any `transition*`/`animation*` declaration (a value of exactly `none` is exempt) or `scroll-behavior: smooth` outside a `prefers-reduced-motion: no-preference` block, and on `.svelte` files using `transition:`, `in:`, `out:` or `animate:` directives unless the file is in `allow`. It throws below `minGuarded` guarded declarations.
- The walkers `cssFiles(uiDir)` (every `.css`/`.svelte` style block, comments stripped), `rules(css)` (top-level rules with their media conditions) and `stripComments(css)` are exported for tests that need the raw walk.

Depends on: `@partygame/client-utils`, `@partygame/game-client`, `@partygame/shared`, `svelte`, `uqr`, `zod`

Guide: [docs/framework/README.md#game-ui-viewmodels](../../docs/framework/README.md#game-ui-viewmodels) ([Components](../../docs/framework/README.md#components))
