<script lang="ts" generics="TState extends BaseGameState">
import type { GameConnectionManager } from "@partygame/game-client";
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import { downloadReplay } from "../replayDownload.js";

const { manager }: { manager: GameConnectionManager<TState> } = $props();

/** Asks the server for the room's replay bundle and downloads it as a JSON file. */
async function exportBundle(): Promise<void> {
  const response = await manager.exportReplay();
  downloadReplay(response);
}
</script>

<button type="button" class="btn" onclick={() => void exportBundle()}>Export replay</button>
