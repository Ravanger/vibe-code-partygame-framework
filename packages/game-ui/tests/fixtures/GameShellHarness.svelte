<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import type { AppRouter } from "../../src/AppRouter.js";
import { GameShell } from "../../src/components/index.js";
import type { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";
import ShellJoinFixture from "./ShellJoinFixture.svelte";
import ShellWelcomeFixture from "./ShellWelcomeFixture.svelte";
import { SHELL_SCREENS } from "./shellScreens.js";

const {
  router,
  controls,
  headingSelector,
}: {
  router: AppRouter<BaseGameState, typeof SHELL_SCREENS>;
  controls: GameControlsViewModel<BaseGameState>;
  headingSelector?: string;
} = $props();
</script>

<GameShell {router} {controls} {...(headingSelector === undefined ? {} : { headingSelector })}>
  {#snippet wordmark()}TestGame{/snippet}
  {#snippet welcome()}<ShellWelcomeFixture />{/snippet}
  {#snippet joinNextRound()}<ShellJoinFixture />{/snippet}
  {#snippet phase(phase)}
    {@const Screen = SHELL_SCREENS[phase].component}
    <Screen />
  {/snippet}
</GameShell>
