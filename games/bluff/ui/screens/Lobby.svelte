<script lang="ts">
import { WaitingRoomViewModel } from "@partygame/game-ui";
import { LobbyScreen } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { LobbySettingsViewModel } from "../viewmodels/LobbySettingsViewModel.svelte.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new WaitingRoomViewModel(manager));
const settings = untrack(() => new LobbySettingsViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<LobbyScreen {vm} {settings} />
