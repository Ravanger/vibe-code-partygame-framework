<script lang="ts">
import { untrack } from "svelte";
import ProgressBadges from "../components/ProgressBadges.svelte";
import type { WitClashManager } from "../manager.js";
import { PromptingViewModel } from "../viewmodels/PromptingViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new PromptingViewModel(manager));

$effect(() => () => vm.destroy());

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void vm.submit();
  }
}
</script>

<div class="prompting">
  <div class="header">
    <div class="round-info">
      <span>{vm.roundLabel}</span>
      {#if vm.categoryLabel}
        <span class="category">{vm.categoryLabel}</span>
      {/if}
    </div>
    <div class="timer" class:urgent={vm.isUrgent}>{`${vm.secondsLeft}s`}</div>
  </div>

  <ProgressBadges rows={vm.progress.rows} />

  {#if vm.isSpectator}
    <div class="waiting spectating">{`${vm.answersIn} of ${vm.answersExpected} answers in`}</div>
  {:else if vm.isSittingOut}
    <div class="waiting">You're sitting this round out — you'll vote on the answers.</div>
  {:else}
    <div class="prompt-nav">
      {#each vm.prompts as prompt, index (prompt.matchupId)}
        <button type="button"
          class="nav-dot"
          class:active={vm.currentIndex === index}
          class:done={prompt.submitted}
          aria-label="Prompt {index + 1}"
          onclick={() => vm.goTo(index)}
        >
          {index + 1}
        </button>
      {/each}
    </div>

    <div class="prompt-section">
      <h2 class="prompt-text">{vm.current?.promptText}</h2>

      <textarea
        class="answer-input"
        placeholder="Type your answer..."
        aria-label="Your answer"
        maxlength="200"
        value={vm.draft}
        oninput={(e) => vm.setDraft(e.currentTarget.value)}
        onkeydown={handleKeydown}
      ></textarea>

      <div class="input-footer">
        <span class:low={vm.charsRemaining < 20}>{`${vm.charsRemaining} chars left`}</span>
        <button type="button" class="submit-btn" onclick={() => vm.submit()} disabled={!vm.canSubmit}>
          {vm.current?.submitted ? "Update" : "Submit"}
        </button>
      </div>
    </div>

    {#if vm.allSubmitted}
      <div class="all-done">
        {`All answers in! Waiting for the others: ${vm.answersIn} of ${vm.answersExpected} answers in`}
      </div>
    {/if}
  {/if}
</div>

<style>
  .prompting {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .round-info {
    font-size: 1.1rem;
    color: #666;
    font-weight: 500;
  }

  .category {
    display: block;
    font-size: 1.3rem;
    color: #333;
    font-weight: 600;
  }

  .timer {
    font-size: 2.5rem;
    font-weight: bold;
    color: #333;
    font-variant-numeric: tabular-nums;
  }

  .timer.urgent {
    color: #f57c00;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .waiting {
    text-align: center;
    color: #666;
    padding: 40px;
    font-size: 1.2rem;
  }

  .prompt-nav {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .prompt-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt-text {
    font-size: 1.8rem;
    color: #333;
    margin: 0;
    text-align: center;
    line-height: 1.4;
  }

  .answer-input {
    width: 100%;
    min-height: 120px;
    padding: 16px;
    font-size: 1.1rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  .answer-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .answer-input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .input-footer span {
    font-size: 0.9rem;
    color: #888;
  }

  .input-footer span.low {
    color: #e53935;
    font-weight: 600;
  }

  .submit-btn {
    padding: 12px 32px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    background: #667eea;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: #5a67d8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
  }

  .submit-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .all-done {
    text-align: center;
    padding: 20px;
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    border-radius: 12px;
    color: #2e7d32;
    font-size: 1.1rem;
    font-weight: 500;
  }

  .prompt-nav .nav-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid #e0e0e0;
    background: white;
    cursor: pointer;
    font-weight: 600;
    color: #999;
  }

  .prompt-nav .nav-dot.done {
    border-color: #22c55e;
    color: #16a34a;
  }

  .prompt-nav .nav-dot.active {
    border-color: #667eea;
    background: #667eea;
    color: white;
  }
</style>
