<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { PromptingViewModel } from "../viewmodels/PromptingViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

const vm = new PromptingViewModel(manager);

$effect(() => {
  return () => vm.destroy();
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    vm.submit();
  }
}
</script>

<div class="prompting">
  <div class="header">
    <div class="round-info">Round {manager.room?.state.roundNumber} of {manager.room?.state.totalRounds}</div>
    <div class="timer" class:urgent={vm.countdown.isUrgent}>
      {vm.countdown.secondsLeft}s
    </div>
  </div>

  {#if vm.myPrompts.length === 0}
    <div class="waiting">Waiting for prompts...</div>
  {:else}
    <div class="prompt-nav">
      <span class:active={vm.currentIndex === 0} on:click={() => vm.goTo(0)} on:keydown={handleKeydown}>1</span>
      <span class:active={vm.currentIndex === 1} on:click={() => vm.goTo(1)} on:keydown={handleKeydown}>2</span>
    </div>

    <div class="prompt-section">
      <h2 class="prompt-text">{vm.current?.promptText}</h2>

      <textarea
        class="answer-input"
        placeholder="Type your answer..."
        maxlength="200"
        bind:value={vm.draft}
        on:keydown={handleKeydown}
        disabled={!vm.current}
      ></textarea>

      <div class="input-footer">
        <span class:low={vm.charsRemaining < 20}>{vm.charsRemaining} chars left</span>
        <button
          class="submit-btn"
          on:click={() => vm.submit()}
          disabled={!vm.canSubmit}
        >
          {vm.submitted[vm.current?.matchupId ?? ""] ? "Update" : "Submit"}
        </button>
      </div>
    </div>

    {#if vm.allSubmitted}
      <div class="all-done">
        Both answers in! Waiting for the others — {vm.progress}
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

  .prompt-nav span {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #e0e0e0;
    cursor: pointer;
    font-weight: 600;
    color: #999;
    transition: all 0.15s ease;
  }

  .prompt-nav span.active {
    border-color: #667eea;
    background: #667eea;
    color: white;
  }

  .prompt-nav span:hover:not(.active) {
    border-color: #667eea;
    color: #667eea;
  }

  .prompt-nav span:focus-visible {
    outline: 3px solid #667eea;
    outline-offset: 2px;
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
</style>
