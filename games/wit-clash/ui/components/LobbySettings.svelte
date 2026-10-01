<script lang="ts">
import { untrack } from "svelte";
import type { WitClashManager } from "../manager.js";
import { LobbySettingsViewModel } from "../viewmodels/LobbySettingsViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new LobbySettingsViewModel(manager));
</script>

<div class="settings">
  <h3>Settings</h3>
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
</div>

<style>
  .settings {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  h3 {
    margin: 0 0 12px;
    color: #444;
  }

  dl {
    margin: 0;
    display: grid;
    gap: 8px;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  dt,
  label {
    color: #666;
  }

  dd {
    margin: 0;
    font-weight: 600;
  }

  input {
    width: 5rem;
    padding: 6px 8px;
    border: 2px solid #eee;
    border-radius: 6px;
    font-size: 1rem;
  }
</style>
