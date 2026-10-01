<script lang="ts">
import { untrack } from "svelte";
import { readUrlCode, readUrlTvCode } from "../config.js";
import type { WitClashManager } from "../manager.js";
import { WelcomeViewModel } from "../viewmodels/WelcomeViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));

$effect(() => {
  void vm.autoJoinIfRequested();
});
</script>

<div class="welcome">
  <h1>WitClash</h1>

  {#if vm.localError}
    <p class="error" role="alert">
      <span>{vm.localError}</span>
      <button type="button" class="dismiss" onclick={() => vm.dismissError()} aria-label="Dismiss">&times;</button>
    </p>
  {/if}

  <button type="button" class="host-btn" disabled={vm.busy} onclick={() => vm.host()}>Host Game</button>

  <div class="join-section">
    <input
      type="text"
      placeholder="Enter code"
      aria-label="Game code"
      maxlength="4"
      value={vm.code}
      oninput={(e) => vm.setCode(e.currentTarget.value)}
    />
    <button type="button" disabled={vm.busy || !vm.codeIsValid} onclick={() => vm.join()}>Join</button>
  </div>
  <button type="button" class="watch-btn" disabled={vm.busy || !vm.codeIsValid} onclick={() => vm.watch()}>
    Watch on a TV
  </button>
</div>

<style>
  .welcome {
    max-width: 500px;
    margin: 0 auto;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
  }

  .error {
    color: #b91c1c;
    background: #fee2e2;
    padding: 10px 16px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .dismiss {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.3rem;
    cursor: pointer;
    padding: 0 4px;
    flex-shrink: 0;
  }


  .host-btn {
    padding: 14px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
  }

  .host-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .join-section {
    display: flex;
    gap: 8px;
  }

  .join-section input {
    padding: 10px 14px;
    font-size: 1rem;
    border: 2px solid #eee;
    border-radius: 8px;
    text-transform: uppercase;
  }

  .join-section button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: #f0f0f0;
    cursor: pointer;
  }

  .watch-btn {
    padding: 10px 20px;
    border: 2px solid #eee;
    border-radius: 8px;
    background: white;
    cursor: pointer;
  }

  .watch-btn:disabled {
    color: #aaa;
    cursor: not-allowed;
  }

  .join-section button:disabled {
    color: #aaa;
    cursor: not-allowed;
  }

</style>
