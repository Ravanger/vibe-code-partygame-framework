<script lang="ts">
import type { HowToPlayViewModel } from "../HowToPlayViewModel.svelte.js";
import { getStrings } from "../strings.js";

const { vm }: { vm: HowToPlayViewModel } = $props();
const strings = getStrings();
</script>

<button type="button" class="btn btn--ghost" onclick={() => vm.openSheet()}>
  {strings.howToPlay}
</button>
