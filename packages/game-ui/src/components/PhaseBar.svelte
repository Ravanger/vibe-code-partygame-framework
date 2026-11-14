<script lang="ts">
import type { PhaseClock } from "../PhaseClock.js";
import { getStrings } from "../strings.js";

const strings = getStrings();

const { clock }: { clock: PhaseClock } = $props();
</script>

<div class="phase-bar">
  <p class="label hand">{strings.nextUpIn(clock.secondsLeft)}</p>
  <div class="track" aria-hidden="true">
    <div class="drain" style:width={`${clock.fraction * 100}%`}></div>
  </div>
</div>

<style>
  .phase-bar {
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
    border-radius: 999px;
    background: var(--white);
    overflow: hidden;
  }

  .drain {
    height: 100%;
    background: var(--color-1);
  }

  @media (prefers-reduced-motion: no-preference) {
    .drain {
      transition: width 1s linear;
    }
  }
</style>
