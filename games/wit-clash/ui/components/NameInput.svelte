<script lang="ts">
import type { NameField } from "../viewmodels/NameField.svelte.js";

const { field }: { field: NameField } = $props();
</script>

<div class="your-name">
  <label for="playerName">Your name</label>
  <input
    id="playerName"
    type="text"
    placeholder="Enter your name"
    maxlength="20"
    value={field.draft}
    oninput={(e) => field.set(e.currentTarget.value)}
  />
</div>

<style>
  .your-name {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .your-name label {
    font-size: 0.9rem;
    color: #666;
  }

  .your-name input {
    padding: 10px 14px;
    font-size: 1rem;
    border: 2px solid #eee;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .your-name input:focus {
    outline: none;
    border-color: #2196F3;
  }
</style>
