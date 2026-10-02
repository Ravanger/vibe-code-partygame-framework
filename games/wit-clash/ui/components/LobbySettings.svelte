<script lang="ts">
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";
import { LobbySettingsViewModel } from "../viewmodels/LobbySettingsViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new LobbySettingsViewModel(manager));
</script>

<details class="settings card" open={vm.startsOpen}>
  <summary class="summary-with-marker">Game settings</summary>
  <dl>
    {#each vm.fields as field (field.key)}
      <div class="setting">
        {#if vm.canEdit}
          <label for={`opt-${field.key}`}>{field.label}</label>
          <input
            id={`opt-${field.key}`}
            type="number"
            min={field.min}
            max={field.max}
            step="1"
            value={vm.valueOf(field.key)}
            oninput={(e) => vm.setDraft(field.key, e.currentTarget.value)}
            onchange={() => vm.commit(field.key)}
          />
        {:else}
          <dt>{field.label}</dt>
          <dd>{vm.valueOf(field.key)}</dd>
        {/if}
      </div>
    {/each}
  </dl>
</details>

<style>
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    cursor: pointer;
  }

  .summary-with-marker {
    position: relative;
    padding-left: 1.5rem;
  }

  .summary-with-marker::before {
    content: "▸";
    position: absolute;
    left: 0;
    color: var(--ink);
  }

  details[open] .summary-with-marker::before {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: no-preference) {
    .summary-with-marker::before {
      transition: transform 0.2s ease;
    }
  }

  dl {
    margin: 0.5rem 0 0;
    display: grid;
    gap: 0.5rem;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }

  dt,
  label {
    color: var(--ink-soft);
  }

  dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  input {
    width: 5rem;
    min-height: 44px;
    padding: 0 0.6rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: var(--fs-3);
    text-align: center;
  }
</style>
