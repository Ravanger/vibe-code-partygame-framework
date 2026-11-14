<script lang="ts">
import { readUrlCode, readUrlTvCode } from "@partygame/game-client";
import { WelcomeViewModel } from "@partygame/game-ui";
import { WelcomeScreen } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));
</script>

<WelcomeScreen vm={vm} title="WitClash" tagline="Write funny answers. Vote for the best. Win bragging rights." />
