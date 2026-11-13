<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import WelcomeScreen from "../../src/components/WelcomeScreen.svelte";
import type { WelcomeViewModel } from "../../src/WelcomeViewModel.svelte.js";

const { vm }: { vm: WelcomeViewModel<BaseGameState> } = $props();
</script>

<WelcomeScreen {vm} title="TestGame" tagline="A test tagline.">
  {#snippet howToPlay()}
    <button type="button">How to play</button>
  {/snippet}
</WelcomeScreen>
