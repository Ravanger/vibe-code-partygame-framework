<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import GameControls from "../../src/components/GameControls.svelte";
import type { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";

const { vm }: { vm: GameControlsViewModel<BaseGameState> } = $props();
</script>

<GameControls {vm}>
  {#snippet howToPlay()}
    <button type="button">How to play</button>
  {/snippet}
</GameControls>
