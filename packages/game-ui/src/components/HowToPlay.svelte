<script lang="ts">
import type { HowToPlayStep, HowToPlayViewModel } from "../HowToPlayViewModel.svelte.js";
import { getStrings } from "../strings.js";
import { nextId } from "./uniqueId.js";

const { vm, steps }: { vm: HowToPlayViewModel; steps: readonly HowToPlayStep[] } = $props();
const strings = getStrings();

/** The tabbable elements the focus trap walks while the sheet is open. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isCarousel = $derived(vm.isSpectator);
const dialogOpen = $derived(!isCarousel && vm.open && steps.length > 0);
const step = $derived(steps[vm.stepIndex]);

// $state so the open effect re-runs once the overlay (and thus `root`) has rendered.
let root = $state<HTMLElement | undefined>(undefined);
let sheet = $state<HTMLDivElement | undefined>(undefined);
let opener: HTMLElement | null = null;
const titleId = nextId("how-to-play-title");
const inerted: HTMLElement[] = [];

/** Makes every element between the page root and the sheet inert, restoring exactly what it set. */
function setBackgroundInert(value: boolean): void {
  for (const el of inerted) el.inert = false;
  inerted.length = 0;
  if (!value || root === undefined) return;
  let level: Element | null = root.parentElement;
  while (level !== null && level !== document.documentElement) {
    for (const child of Array.from(level.children)) {
      if (child.contains(root) || !(child instanceof HTMLElement) || child.inert) continue;
      child.inert = true;
      inerted.push(child);
    }
    level = level.parentElement;
  }
}

// Once per browser: open the sheet on a first visit (dialog mode only).
$effect(() => {
  if (!isCarousel && steps.length > 0) vm.autoOpen();
});

// While open: the background goes inert; on close, focus returns to the opener.
$effect(() => {
  if (!dialogOpen) return;
  const active = document.activeElement;
  opener = active instanceof HTMLElement ? active : null;
  setBackgroundInert(true);
  return () => {
    setBackgroundInert(false);
    const el = opener;
    opener = null;
    if (el !== null && document.contains(el)) el.focus();
  };
});

// Focus the sheet once it has rendered: on a first visit the dialog mounts after autoOpen flips open.
$effect(() => {
  if (!dialogOpen || sheet === undefined) return;
  sheet.focus();
});

// The seatless viewer gets the auto-advancing carousel; it stops for good on user input.
$effect(() => {
  if (!isCarousel || steps.length <= 1) return;
  vm.startCarousel();
  return () => vm.pauseCarousel();
});

function onKeydown(event: KeyboardEvent): void {
  if (!dialogOpen) return;
  if (event.key === "Escape") {
    vm.closeSheet();
    return;
  }
  if (event.key !== "Tab" || sheet === undefined) return;
  const focusables = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
  // The sheet always renders its close button, so both ends exist.
  const first = focusables[0] as HTMLElement;
  const last = focusables[focusables.length - 1] as HTMLElement;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === sheet)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onNavigate(delta: number): void {
  if (isCarousel) vm.stopCarousel();
  if (delta > 0) vm.next();
  else vm.previous();
}

function onDot(index: number): void {
  if (isCarousel) vm.stopCarousel();
  vm.goTo(index);
}
</script>

<svelte:window onkeydown={onKeydown} />

{#if steps.length > 0}
  {#snippet stepContent(step: HowToPlayStep | undefined)}
    {#if step !== undefined}
      <h3 class="step-title">{step.title}</h3>
      <p class="step-body">{step.body}</p>
      {#if step.illustration !== undefined}{@render step.illustration()}{/if}
      {#if step.example !== undefined}<div class="example">{@render step.example()}</div>{/if}
    {/if}
  {/snippet}

  {#snippet dotsAndNav()}
    <div class="dots">
      {#each steps.keys() as i (i)}
        <button
          type="button"
          class="dot"
          class:active={i === vm.stepIndex}
          aria-label={strings.stepLabel(i + 1, steps.length)}
          aria-current={i === vm.stepIndex ? "step" : undefined}
          onclick={() => onDot(i)}
        ></button>
      {/each}
    </div>
    <div class="nav">
      <button type="button" class="btn btn--ghost nav-btn" onclick={() => onNavigate(-1)}>
        {strings.previousStep}
      </button>
      <button type="button" class="btn btn--ghost nav-btn" onclick={() => onNavigate(1)}>
        {strings.nextStep}
      </button>
    </div>
  {/snippet}

  {#if isCarousel}
    <section class="card how-to-play--carousel" aria-label={strings.howToPlay}>
      <h2 class="heading">{strings.howToPlay}</h2>
      {#key vm.stepIndex}
        <div class="step-anim">{@render stepContent(step)}</div>
      {/key}
      {@render dotsAndNav()}
    </section>
  {:else if dialogOpen}
    <div class="how-to-play-overlay" bind:this={root}>
      <div
        class="sheet card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabindex="-1"
        bind:this={sheet}
      >
        <button type="button" class="close-btn" aria-label={strings.closeSheet} onclick={() => vm.closeSheet()}>&times;</button>
        <h2 id={titleId} class="heading">{strings.howToPlay}</h2>
        {#key vm.stepIndex}
          <div class="step-anim">{@render stepContent(step)}</div>
        {/key}
        {@render dotsAndNav()}
      </div>
    </div>
  {/if}
{/if}

<style>
  .how-to-play-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--ink) 60%, transparent);
  }

  .sheet {
    position: relative;
    width: min(480px, 100%);
    max-height: 85dvh;
    overflow-y: auto;
  }

  .heading {
    margin: 0 2.75rem 0.75rem 0;
    font-family: var(--font-display);
    font-size: calc(var(--fs-4) * var(--scale, 1));
  }

  .step-title {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .step-body {
    margin: 0;
    color: var(--ink);
    font-size: calc(var(--fs-2) * var(--scale, 1));
    line-height: 1.5;
  }

  .example {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .dot {
    width: 12px;
    height: 12px;
    padding: 0;
    border: 2px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--white);
    cursor: pointer;
  }

  .dot.active {
    background: var(--accent);
  }

  .nav {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .nav-btn {
    flex: 1;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 44px;
    min-height: 44px;
    border: none;
    background: none;
    color: var(--ink);
    font-size: var(--fs-4);
    cursor: pointer;
  }

  .how-to-play--carousel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  @keyframes htp-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .step-anim {
      animation: htp-fade 0.25s ease-out;
    }
  }
</style>
