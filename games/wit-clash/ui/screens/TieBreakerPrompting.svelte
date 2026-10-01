<script lang="ts">
import { untrack } from "svelte";
import ProgressBadges from "../components/ProgressBadges.svelte";
import type { WitClashManager } from "../manager.js";
import { TieBreakerViewModel } from "../viewmodels/TieBreakerViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new TieBreakerViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="tie-breaker">
  <h1>Tie-breaker!</h1>
  <p class="tied">{`Tied for the lead: ${vm.contenderNames.join(", ")}`}</p>
  <div class="timer" class:urgent={vm.isUrgent}>{`${vm.secondsLeft}s`}</div>
  <h2 class="prompt">{vm.promptText}</h2>
  <ProgressBadges rows={vm.progress.rows} />

  {#if vm.isContender}
    <textarea
      class="answer-input"
      placeholder="Type your answer..."
      aria-label="Your answer"
      maxlength="200"
      value={vm.draft}
      oninput={(e) => vm.setDraft(e.currentTarget.value)}
    ></textarea>
    <div class="footer">
      <span>{`${vm.charsRemaining} chars left`}</span>
      <button type="button" disabled={!vm.canSubmit} onclick={() => vm.submit()}>
        {vm.hasSubmitted ? "Update" : "Submit"}
      </button>
    </div>
  {:else}
    <p class="notice">Sit tight while the tied players answer.</p>
  {/if}
</div>

<style>
  .tie-breaker {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .timer {
    font-size: 2.5rem;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .timer.urgent {
    color: #f57c00;
  }

  .prompt {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1.4;
  }

  .answer-input {
    width: 100%;
    min-height: 120px;
    padding: 16px;
    font-size: 1.1rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    font-family: inherit;
    box-sizing: border-box;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  button {
    padding: 12px 32px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    background: #667eea;
    color: white;
    cursor: pointer;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .notice,
  .tied {
    margin: 0;
    color: #666;
    font-style: italic;
  }
</style>
