<script lang="ts">
import { JoinNextRoundViewModel } from "@partygame/game-ui";
import { NameInput, StatusPanel } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { __PascalName__Manager } from "../manager.js";
import { PHASE_SCREENS } from "./index.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new JoinNextRoundViewModel(manager, PHASE_SCREENS));

$effect(() => () => vm.destroy());
</script>

<div class="join-next-round">
  <h1>{vm.heading}</h1>
  <p class="hint">{vm.hint}</p>
  {#if vm.needsName}
    <NameInput field={vm.nameField} focus />
  {/if}
  <StatusPanel tone="wait" title={`${vm.phaseLabel}.`} />
</div>

<style>
  .join-next-round {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    padding-top: 2rem;
  }

  h1 {
    margin: 0;
    font-size: var(--fs-4);
  }

  .hint {
    margin: 0;
    color: var(--ink-soft);
  }
</style>
