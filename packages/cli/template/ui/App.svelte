<script lang="ts">
import { createAppRouter, GameControlsViewModel } from "@partygame/game-ui";
import { GameShell } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import { isGameOver } from "../src/isGameOver.js";
import type { __PascalName__Manager } from "./manager.js";
import { PHASE_SCREENS } from "./screens/index.js";
import JoinNextRound from "./screens/JoinNextRound.svelte";
import Welcome from "./screens/Welcome.svelte";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => createAppRouter(manager, PHASE_SCREENS));
const controls = untrack(() => new GameControlsViewModel(manager, isGameOver));
</script>

<GameShell router={vm} controls={controls}>
  {#snippet wordmark()}__DisplayNameHtml__{/snippet}
  {#snippet welcome()}<Welcome {manager} />{/snippet}
  {#snippet joinNextRound()}<JoinNextRound {manager} />{/snippet}
  {#snippet phase(phase)}
    {@const Screen = PHASE_SCREENS[phase].component}
    <Screen {manager} />
  {/snippet}
</GameShell>
