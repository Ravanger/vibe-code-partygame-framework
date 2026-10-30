<script lang="ts">
  import type { SoundPolicy } from "../SoundPolicy.svelte.js";

  const {
    policy,
    on = "Sound on",
    off = "Sound off",
  }: { policy: SoundPolicy; on?: string; off?: string } = $props();
</script>

<button type="button" aria-pressed={policy.enabled} onclick={() => policy.toggle()}>
  {policy.enabled ? on : off}
</button>

<style>
  button {
    padding: 0.4rem 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    cursor: pointer;
  }

  button[aria-pressed="true"] {
    background: var(--ink);
    color: var(--paper);
  }
</style>
