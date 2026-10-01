<script lang="ts">
import { untrack } from "svelte";
import NameInput from "../components/NameInput.svelte";
import Scoreboard from "../components/Scoreboard.svelte";
import type { WitClashManager } from "../manager.js";
import { JoinNextRoundViewModel } from "../viewmodels/JoinNextRoundViewModel.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new JoinNextRoundViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="join-next-round">
  <h1>{vm.heading}</h1>
  {#if vm.hint}
    <p class="hint">{vm.hint}</p>
  {/if}
  {#if vm.needsName}
    <NameInput field={vm.nameField} />
  {/if}
  <p class="status">{`${vm.phaseLabel}.`}</p>
  {#if vm.roundLabel}
    <p class="round">{vm.roundLabel}</p>
  {/if}

  {#if vm.scoreboard.rows.length > 0}
    <Scoreboard rows={vm.scoreboard.rows} />
  {/if}
</div>

<style>
  .join-next-round {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    color: #333;
  }

  .hint,
  .status,
  .round {
    margin: 0;
    color: #666;
  }
</style>
