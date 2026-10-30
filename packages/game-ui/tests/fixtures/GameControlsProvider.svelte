<script lang="ts">
import type { GameControlsViewModel } from "@partygame/game-ui";
import type { BaseGameState } from "@partygame/shared/schema";
import GameControls from "../../src/components/GameControls.svelte";
import { setStrings } from "../../src/strings.js";

const { vm }: { vm: GameControlsViewModel<BaseGameState> } = $props();
setStrings({ leaveGame: "Spiel verlassen" });
</script>

<GameControls {vm} />
