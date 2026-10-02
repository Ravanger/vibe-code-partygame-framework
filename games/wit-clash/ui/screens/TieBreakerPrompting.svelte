<script lang="ts">
import { untrack } from "svelte";
import ActionBar from "../components/ActionBar.svelte";
import AnswerBox from "../components/AnswerBox.svelte";
import ProgressBadges from "../components/ProgressBadges.svelte";
import ScreenTitle from "../components/ScreenTitle.svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import Timer from "../components/Timer.svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="tie-breaker">
  <div class="top">
    <span class="chip chip--paper">{`Tied for the lead: ${vm.contenderNames.join(", ")}`}</span>
    <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
  </div>

  <ScreenTitle title="Tie-breaker!" />

  <div class="question card taped">
    <h2>{vm.promptText}</h2>
  </div>

  <ProgressBadges rows={vm.progress.rows} />

  {#if vm.isContender}
    <p class="how hand">Write the funniest answer you can</p>
    <AnswerBox
      value={vm.draft}
      remaining={vm.charsRemaining}
      oninput={(value) => vm.setDraft(value)}
      onsubmit={() => vm.submit()}
    />
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" disabled={!vm.canSubmit} onclick={() => vm.submit()}>
        {vm.hasSubmitted ? "Update" : "Submit"}
      </button>
    </ActionBar>
  {:else}
    <StatusPanel tone="wait" title="Sit tight while the tied players answer." />
  {/if}
</div>

<style>
  .tie-breaker {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .question {
    --tilt: -1deg;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1.25;
  }

  .how {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--fs-3);
    text-align: center;
  }
</style>
