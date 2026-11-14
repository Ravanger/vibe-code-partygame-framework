<script lang="ts">
import { readUrlCode, readUrlTvCode } from "@partygame/game-client";
import { WelcomeViewModel } from "@partygame/game-ui";
import { WelcomeScreen } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { __PascalName__Manager } from "../manager.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));
</script>

<WelcomeScreen vm={vm} title="__DisplayNameHtml__" tagline="Wave as fast as you can. First to the goal wins." />
