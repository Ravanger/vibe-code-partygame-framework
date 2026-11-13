<script lang="ts">
import { WaitingRoomViewModel } from "@partygame/game-ui";
import { LobbyScreen } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new WaitingRoomViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<LobbyScreen {vm} />
