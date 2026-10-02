<script lang="ts">
import { ActionBar, StatusPanel, Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import AnswerBox from "../components/AnswerBox.svelte";
import ProgressBadges from "../components/ProgressBadges.svelte";
import type { WitClashManager } from "../manager.js";
import { PromptingViewModel } from "../viewmodels/PromptingViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new PromptingViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="prompting">
  <div class="top">
    <div class="chips">
      <span class="chip chip--paper">{vm.roundLabel}</span>
      {#if vm.categoryLabel}
        <span class="chip">{vm.categoryLabel}</span>
      {/if}
    </div>
    <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />
  </div>

  {#if vm.isSpectator}
    <p class="tv-count">{`${vm.answersIn} of ${vm.answersExpected} answers in`}</p>
    <ProgressBadges rows={vm.progress.rows} />
  {:else if vm.isSittingOut}
    <StatusPanel tone="info" title="You're sitting this round out — you'll vote on the answers." />
    <ProgressBadges rows={vm.progress.rows} />
  {:else if !vm.showForm}
    <StatusPanel
      tone="done"
      title="All answers in!"
      detail={`Waiting for the others: ${vm.answersIn} of ${vm.answersExpected} answers in`}
    />
    <ProgressBadges rows={vm.progress.rows} />
    <button type="button" class="btn btn--ghost edit" onclick={() => vm.startEditing()}>Edit answers</button>
  {:else}
    <ProgressBadges rows={vm.progress.rows} />

    <div class="tabs">
      {#each vm.prompts as prompt, index (prompt.matchupId)}
        <button
          type="button"
          class="btn tab"
          class:active={vm.currentIndex === index}
          class:done={prompt.submitted}
          aria-label={`Prompt ${index + 1}`}
          aria-pressed={vm.currentIndex === index}
          onclick={() => vm.goTo(index)}
        >
          {`Prompt ${index + 1}`}
          {#if prompt.submitted}
            <span aria-hidden="true">&#10003;</span>
          {/if}
        </button>
      {/each}
    </div>

    {#key vm.currentIndex}
      <div class="question card taped">
        <h2>{vm.current?.promptText}</h2>
      </div>
    {/key}
    <p class="how hand">Write the funniest answer you can</p>

    <AnswerBox
      value={vm.draft}
      remaining={vm.charsRemaining}
      oninput={(value) => vm.setDraft(value)}
      onsubmit={() => vm.submit()}
    />

    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" onclick={() => vm.submit()} disabled={!vm.canSubmit}>
        {vm.current?.submitted ? "Update" : "Submit"}
      </button>
    </ActionBar>
  {/if}
</div>

<style>
  .prompting {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tabs {
    display: flex;
    gap: 0.6rem;
  }

  .tab {
    flex: 1;
    min-height: 44px;
    box-shadow: 0 3px 0 var(--ink);
  }

  .tab.active {
    background: var(--sun);
  }

  .tab.done:not(.active) {
    background: var(--mint);
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

  :global(main.tv) h2 {
    font-size: calc(var(--fs-5) * var(--scale, 1));
  }

  .how {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--fs-3);
    text-align: center;
  }

  .edit {
    align-self: center;
  }

  .tv-count {
    margin: 0 0 1.5rem;
    font-family: var(--font-display);
    font-size: calc(var(--fs-5) * var(--scale, 1));
    text-align: center;
  }

  @keyframes wobble {
    0%,
    100% {
      transform: rotate(-1deg);
    }
    30% {
      transform: rotate(1.5deg) scale(1.02);
    }
    60% {
      transform: rotate(-2deg);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .question {
      animation: wobble 0.45s ease-out;
    }
  }
</style>
