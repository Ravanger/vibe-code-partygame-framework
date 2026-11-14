<script lang="ts">
import { readUrlCode, readUrlTvCode } from "@partygame/game-client";
import { WelcomeViewModel } from "@partygame/game-ui";
import { WelcomeScreen } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));
</script>

<WelcomeScreen vm={vm} title="Bluff" tagline="Fake an answer, then spot the real one." />
