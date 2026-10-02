<script lang="ts">
const { seconds, total }: { seconds: number; total: number } = $props();

const fraction = $derived(total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0);
</script>

<div class="next-up">
  <p class="label hand">{`Next up in ${seconds}s`}</p>
  <div class="track" aria-hidden="true">
    <div class="drain" style:width={`${fraction * 100}%`}></div>
  </div>
</div>

<style>
  .next-up {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: auto;
  }

  .label {
    margin: 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  .track {
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--white);
    overflow: hidden;
  }

  .drain {
    height: 100%;
    background: var(--pink);
  }

  @media (prefers-reduced-motion: no-preference) {
    .drain {
      transition: width 1s linear;
    }
  }
</style>
