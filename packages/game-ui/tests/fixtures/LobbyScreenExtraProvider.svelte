<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import LobbyScreen from "../../src/components/LobbyScreen.svelte";
import type { WaitingRoomViewModel } from "../../src/WaitingRoomViewModel.svelte.js";

const { vm }: { vm: WaitingRoomViewModel<BaseGameState> } = $props();
</script>

<LobbyScreen {vm}>
  {#snippet extra()}
    <p class="extra-line">Extra line.</p>
  {/snippet}
</LobbyScreen>
