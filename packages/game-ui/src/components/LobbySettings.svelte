<script lang="ts" generics="TState extends BaseGameState">
import type { LobbySettingsViewModel } from "@partygame/game-ui";
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import { getStrings } from "../strings.js";
import { nextId } from "./uniqueId.js";

const { vm }: { vm: LobbySettingsViewModel<TState> } = $props();
const strings = getStrings();

// One id namespace per mounted instance, so two instances never share input ids.
const idPrefix = nextId("lobby-settings");
</script>

<details class="settings card" open={vm.startsOpen}>
  <summary class="summary-with-marker">{strings.gameSettings}</summary>
  {#if vm.canEdit}
    <ul class="settings-list">
      {#each vm.fields as field (field.key)}
        <li class="setting">
          {#if field.kind === "select"}
            <span class="setting-label">{field.label}</span>
            <fieldset class="choices" aria-label={field.label}>
              {#each field.choices as choice (choice)}
                <button
                  type="button"
                  class:active={vm.valueOf(field.key) === choice}
                  aria-pressed={vm.valueOf(field.key) === choice}
                  onclick={() => vm.choose(field.key, choice)}
                >
                  {choice}
                </button>
              {/each}
            </fieldset>
          {:else if field.kind === "boolean"}
            <label for={`${idPrefix}-${field.key}`}>{field.label}</label>
            <input
              id={`${idPrefix}-${field.key}`}
              type="checkbox"
              checked={vm.valueOf(field.key) === "true"}
              oninput={(e) => vm.setDraft(field.key, String(e.currentTarget.checked))}
              onchange={() => vm.commit(field.key)}
            />
          {:else if field.kind === "text"}
            <label for={`${idPrefix}-${field.key}`}>{field.label}</label>
            <input
              id={`${idPrefix}-${field.key}`}
              type="text"
              maxlength={field.maxLength}
              value={vm.valueOf(field.key)}
              oninput={(e) => vm.setDraft(field.key, e.currentTarget.value)}
              onchange={() => vm.commit(field.key)}
            />
          {:else}
            <label for={`${idPrefix}-${field.key}`}>{field.label}</label>
            <input
              id={`${idPrefix}-${field.key}`}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={vm.valueOf(field.key)}
              oninput={(e) => vm.setDraft(field.key, e.currentTarget.value)}
              onchange={() => vm.commit(field.key)}
            />
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <dl>
      {#each vm.fields as field (field.key)}
        <dt>{field.label}</dt>
        <dd>{vm.valueOf(field.key)}</dd>
      {/each}
    </dl>
  {/if}
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
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    row-gap: 0.5rem;
    align-items: center;
  }

  .settings-list {
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
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
    min-height: 44px;
  }

  dd {
    margin: 0;
    justify-self: end;
    min-height: 44px;
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

  input[type="text"] {
    width: 8rem;
  }

  input[type="checkbox"] {
    width: auto;
    padding: 0;
  }

  .setting-label {
    color: var(--ink-soft);
  }

  .choices {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .choices button {
    min-height: 44px;
    padding: 0.2rem 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: var(--fs-3);
    cursor: pointer;
  }

  .choices button.active {
    background: var(--color-2);
  }
</style>
