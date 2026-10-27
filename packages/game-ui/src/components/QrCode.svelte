<script lang="ts">
import { qrCode } from "../qr.js";
import { getStrings } from "../strings.js";

const { text }: { text: string } = $props();
const strings = getStrings();

const code = $derived(qrCode(text));
const margin = 2;
const box = $derived(`${-margin} ${-margin} ${code.size + margin * 2} ${code.size + margin * 2}`);
</script>

<svg class="qr" viewBox={box} role="img" aria-label={strings.qrCode} shape-rendering="crispEdges">
  <rect x={-margin} y={-margin} width={code.size + margin * 2} height={code.size + margin * 2} fill="white" />
  <path d={code.path} fill="black" />
</svg>

<style>
  .qr {
    display: block;
    width: 100%;
    height: auto;
    border: var(--outline);
    border-radius: var(--radius-card);
    box-shadow: var(--scrap-shadow);
  }
</style>
