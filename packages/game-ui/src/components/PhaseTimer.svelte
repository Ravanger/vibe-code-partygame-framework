<script lang="ts">
import type { PhaseClock } from "../PhaseClock.js";
import Timer from "./Timer.svelte";

const { clock }: { clock: PhaseClock } = $props();
</script>

<Timer seconds={clock.secondsLeft} fraction={clock.fraction} announcement={clock.announcement} />
