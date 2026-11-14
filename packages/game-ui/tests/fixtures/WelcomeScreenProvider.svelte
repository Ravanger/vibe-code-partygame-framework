<script lang="ts">
import type { BaseGameState } from "@partygame/shared/schema";
import type { Snippet } from "svelte";
import WelcomeScreen from "../../src/components/WelcomeScreen.svelte";
import type { WelcomeViewModel } from "../../src/WelcomeViewModel.svelte.js";

const { vm, hero }: { vm: WelcomeViewModel<BaseGameState>; hero?: Snippet } = $props();
</script>

<WelcomeScreen {vm} title="TestGame" tagline="A test tagline." {...(hero === undefined ? {} : { hero })} />
