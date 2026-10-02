<script lang="ts">
import { untrack } from "svelte";
import NameInput from "../components/NameInput.svelte";
import Scoreboard from "../components/Scoreboard.svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import type { WitClashManager } from "../manager.js";
import { JoinNextRoundViewModel } from "../viewmodels/JoinNextRoundViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new JoinNextRoundViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="join-next-round">
  <h1>{vm.heading}</h1>
  {#if vm.hint}
    <p class="hint hand">{vm.hint}</p>
  {/if}
  {#if vm.needsName}
    <NameInput field={vm.nameField} focus />
  {/if}
  <StatusPanel tone="wait" title={`${vm.phaseLabel}.`} />
  {#if vm.roundLabel}
    <p class="round"><span class="chip">{vm.roundLabel}</span></p>
  {/if}

  {#if vm.scoreboard.rows.length > 0}
    <Scoreboard rows={vm.scoreboard.rows} />
  {/if}
</div>

<style>
  .join-next-round {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: calc(var(--fs-5) * var(--scale, 1));
    line-height: 1.1;
    text-align: center;
    text-decoration: underline wavy var(--pink) 3px;
    text-underline-offset: 8px;
  }

  .hint {
    margin: 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  .round {
    margin: 0;
    text-align: center;
  }

  :global(main.tv) .join-next-round {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }
</style>
