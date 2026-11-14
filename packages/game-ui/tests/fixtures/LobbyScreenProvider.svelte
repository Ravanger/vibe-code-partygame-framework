<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import LobbyScreen from "../../src/components/LobbyScreen.svelte";
import type { LobbySettingsViewModel } from "../../src/LobbySettingsViewModel.svelte.js";
import type { WaitingRoomViewModel } from "../../src/WaitingRoomViewModel.svelte.js";

const { vm, settings }: {
  vm: WaitingRoomViewModel<BaseGameState>;
  settings?: LobbySettingsViewModel<BaseGameState>;
} = $props();
</script>

<LobbyScreen {vm} {...(settings === undefined ? {} : { settings })} />
