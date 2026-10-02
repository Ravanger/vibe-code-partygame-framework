<script lang="ts">
import type { NameField } from "../viewmodels/NameField.svelte.js";

const { field, focus = false }: { field: NameField; focus?: boolean } = $props();

function takeFocus(node: HTMLInputElement): void {
  if (focus) node.focus();
}
</script>

<div class="your-name card taped">
  <label for="playerName">Your name</label>
  <input
    id="playerName"
    type="text"
    placeholder="Enter your name"
    maxlength="20"
    autocomplete="nickname"
    value={field.draft}
    oninput={(e) => field.set(e.currentTarget.value)}
    use:takeFocus
  />
</div>

<style>
  .your-name {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  input {
    min-height: 52px;
    padding: 0 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }
</style>
