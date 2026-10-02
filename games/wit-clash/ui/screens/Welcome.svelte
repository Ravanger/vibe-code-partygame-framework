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

<div class="welcome stack">
  <div class="hero">
    <h1 class="wordmark">WitClash</h1>
    <p class="tagline">Write funny answers. Vote for the best. Win bragging rights.</p>
  </div>

  {#if vm.localError}
    <div class="error card" role="alert">
      <span>{vm.localError}</span>
      <button type="button" class="dismiss" onclick={() => vm.dismissError()} aria-label="Dismiss">&times;</button>
    </div>
  {/if}

  <button type="button" class="btn btn--primary btn--big" disabled={vm.busy} onclick={() => vm.host()}>Host Game</button>

  <p class="divider"><span>or join a game</span></p>

  <div class="join-section">
    <input
      type="text"
      placeholder="CODE"
      aria-label="Game code"
      maxlength="4"
      inputmode="text"
      autocapitalize="characters"
      autocomplete="off"
      spellcheck="false"
      value={vm.code}
      oninput={(e) => vm.setCode(e.currentTarget.value)}
    />
    <button type="button" class="btn btn--secondary btn--big" disabled={vm.busy || !vm.codeIsValid} onclick={() => vm.join()}>Join</button>
  </div>

  <button type="button" class="btn btn--ghost" disabled={vm.busy || !vm.codeIsValid} onclick={() => vm.watch()}>
    Watch on a TV
  </button>
</div>

<style>
  .welcome {
    margin: auto 0;
    padding-top: 24px;
  }

  .hero {
    position: relative;
    text-align: center;
  }

  .wordmark {
    position: relative;
    display: inline-block;
    margin: 0;
    padding: 0.1em 0.5em;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--pink);
    color: var(--white);
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
    box-shadow: var(--scrap-shadow);
    font-size: var(--fs-7);
    letter-spacing: 0.04em;
    line-height: 1.3;
    text-transform: uppercase;
    transform: rotate(-2deg);
  }

  .wordmark::before {
    content: "";
    position: absolute;
    top: -14px;
    left: 50%;
    width: 96px;
    height: 26px;
    background: var(--tape-sun);
    transform: translateX(-50%) rotate(3deg);
  }

  .tagline {
    margin: 1.4rem 0 0;
    color: var(--ink-soft);
    font-size: var(--fs-4);
    line-height: 1.2;
  }

  .error {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: var(--danger);
    color: var(--white);
    padding: 0.5rem 1rem;
  }

  .dismiss {
    min-width: 44px;
    min-height: 44px;
    border: none;
    background: none;
    color: inherit;
    font-size: var(--fs-4);
    cursor: pointer;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    color: var(--ink-soft);
    font-family: var(--font-hand);
    font-size: var(--fs-3);
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    border-top: 3px dashed var(--ink-soft);
  }

  .join-section {
    display: flex;
    gap: 0.75rem;
  }

  .join-section input {
    flex: 1;
    min-width: 0;
    height: 56px;
    padding: 0 1rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--white);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: var(--fs-5);
    letter-spacing: 0.3em;
    text-align: center;
    text-transform: uppercase;
  }

  .join-section input::placeholder {
    color: var(--ink-soft);
    opacity: 0.6;
  }
</style>
