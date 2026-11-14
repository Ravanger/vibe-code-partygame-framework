<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import type { ReplayManager } from "../../src/ReplayViewModel.svelte.js";

const { manager }: { manager: ReplayManager<BaseGameState> } = $props();
</script>

<h1>{manager.state.phase} screen</h1>
