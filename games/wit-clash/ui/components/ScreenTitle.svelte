<script lang="ts">
const { title, hint = "" }: { title: string; hint?: string } = $props();
</script>

<div class="screen-title">
  <h1>{title}</h1>
  <svg class="underline" viewBox="0 0 120 10" aria-hidden="true" preserveAspectRatio="none">
    <path d="M2 6q7-8 14 0t14 0t14 0t14 0t14 0t14 0t14 0t14 0" />
  </svg>
  {#if hint}
    <p class="hint hand">{hint}</p>
  {/if}
</div>

<style>
  .screen-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: calc(var(--fs-6) * var(--scale, 1));
    line-height: 1.1;
  }

  .underline {
    width: min(14rem, 70%);
    height: 0.6rem;
    fill: none;
    stroke: var(--pink);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .hint {
    margin: 0.4rem 0 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }
</style>
