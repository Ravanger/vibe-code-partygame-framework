<script lang="ts">
import type { Snippet } from "svelte";

const { children }: { children: Snippet } = $props();
</script>

<div class="action-bar">{@render children()}</div>

<style>
  /* the bar bleeds into the screen padding it sits in (the --screen-pad-* tokens) */
  .action-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin: auto calc(var(--screen-pad-x) * -1) calc(var(--screen-pad-y) * -1);
    padding: 1.1rem var(--screen-pad-x) calc(0.9rem + env(safe-area-inset-bottom));
    background-color: var(--paper);
    border-top: 3px solid var(--ink);
  }

  .action-bar > :global(.btn) {
    flex: 1;
    max-width: 420px;
  }

  /* a spectator seat has no actions */
  :global(main.tv) .action-bar {
    display: none;
  }
</style>
