<script lang="ts">
import HowToPlay from "../../src/components/HowToPlay.svelte";
import HowToPlayButton from "../../src/components/HowToPlayButton.svelte";
import type { HowToPlayStep, HowToPlayViewModel } from "../../src/HowToPlayViewModel.svelte.js";

const {
  vm,
  steps,
  withButton = false,
}: {
  vm: HowToPlayViewModel;
  steps: readonly HowToPlayStep[];
  withButton?: boolean;
} = $props();
</script>

<div class="htp-fixture">
  <button type="button" id="background-button">Background</button>
  {#if withButton}
    <HowToPlayButton {vm} />
  {/if}
  <HowToPlay {vm} {steps} />
</div>
