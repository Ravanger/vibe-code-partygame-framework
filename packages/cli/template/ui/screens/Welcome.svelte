<script lang="ts">
import { WelcomeViewModel } from "@partygame/game-ui";
import { untrack } from "svelte";
import { readUrlCode, readUrlTvCode } from "../config.js";
import type { __PascalName__Manager } from "../manager.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new WelcomeViewModel(manager, readUrlCode(), readUrlTvCode()));

$effect(() => {
  void vm.autoJoinIfRequested();
});
</script>

<div class="welcome stack">
  <h1 class="wordmark">__DisplayName__</h1>
  <p class="tagline">Wave as fast as you can. First to the goal wins.</p>

  {#if vm.localError}
    <div class="error card" role="alert">
      <span>{vm.localError}</span>
      <button type="button" class="dismiss" onclick={() => vm.dismissError()} aria-label="Dismiss">&times;</button>
    </div>
  {/if}

  <button type="button" class="btn btn--primary btn--big" disabled={vm.busy} onclick={() => vm.host()}>Host Game</button>

  <p class="or">— or —</p>

  <div class="join-row">
    <input
      class="code-input"
      maxlength="4"
      placeholder="ABCD"
      aria-label="Game code"
      value={vm.code}
      oninput={(event) => vm.setCode(event.currentTarget.value)}
    />
    <button type="button" class="btn btn--primary" disabled={!vm.codeIsValid || vm.busy} onclick={() => vm.join()}>Join</button>
  </div>
</div>

<style>
  .welcome {
    justify-content: center;
    text-align: center;
    padding: 40px 16px;
  }

  .wordmark {
    display: inline-block;
    margin: 0 auto;
    padding: 0.2rem 1.5rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--pink);
    color: var(--white);
    box-shadow: var(--scrap-shadow);
    font-size: var(--fs-5);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transform: rotate(-2deg);
  }

  .tagline {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--fs-2);
  }

  .error {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: var(--danger);
    color: var(--white);
  }

  .dismiss {
    border: none;
    background: none;
    color: inherit;
    font-size: var(--fs-4);
    cursor: pointer;
  }

  .or {
    margin: 0;
    color: var(--ink-soft);
  }

  .join-row {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .code-input {
    min-height: 48px;
    padding: 0 1rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--white);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: var(--fs-3);
    letter-spacing: 6px;
    text-transform: uppercase;
  }
</style>
