<script lang="ts">
const {
  seconds,
  total,
  announcement = "",
}: { seconds: number; total: number; announcement?: string } = $props();

const STICK_START = 6;
const STICK_LENGTH = 92;
const URGENT_AT = 10;

const fraction = $derived(total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0);
const tip = $derived(STICK_START + STICK_LENGTH * fraction);
</script>

<div class="sparkler" class:urgent={seconds <= URGENT_AT}>
  <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  <svg viewBox="0 0 120 40" aria-hidden="true">
    <line class="wire" x1={STICK_START} y1="20" x2={STICK_START + STICK_LENGTH} y2="20" />
    <line class="stick" x1={STICK_START} y1="20" x2={tip} y2="20" />
    <g class="sparks" transform={`translate(${tip} 20)`}>
      <path class="spark" d="M0 -12L3 -3L12 0L3 3L0 12L-3 3L-12 0L-3 -3z" />
      <path class="spark spark-2" d="M10 -10L11 -6L15 -5L11 -4L10 0L9 -4L5 -5L9 -6z" />
      <path class="spark spark-3" d="M8 8L9 11L12 12L9 13L8 16L7 13L4 12L7 11z" />
    </g>
  </svg>
  <span class="number">{seconds}</span>
</div>

<style>
  .sparkler {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
    --spark: var(--sun);
  }

  .sparkler.urgent {
    --spark: var(--pink);
  }

  svg {
    width: calc(var(--timer-size, 96px) * var(--scale, 1));
    height: auto;
    overflow: visible;
  }

  line {
    stroke-linecap: round;
  }

  .wire {
    stroke: var(--ink);
    stroke-opacity: 0.18;
    stroke-width: 5;
  }

  .stick {
    stroke: var(--ink);
    stroke-width: 5;
  }

  .spark {
    fill: var(--spark);
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
    transform-box: fill-box;
    transform-origin: center;
  }

  .number {
    min-width: 2ch;
    font-family: var(--font-display);
    font-size: calc(var(--fs-5) * var(--scale, 1));
    line-height: 1;
    color: var(--ink);
  }

  .urgent .number {
    color: var(--ink);
    text-shadow: 2px 2px 0 var(--pink);
  }

  @keyframes flicker {
    0%,
    100% {
      transform: scale(1) rotate(0);
    }
    35% {
      transform: scale(1.35) rotate(18deg);
    }
    70% {
      transform: scale(0.8) rotate(-12deg);
    }
  }

  @keyframes jiggle {
    0%,
    100% {
      transform: rotate(0);
    }
    30% {
      transform: rotate(-4deg);
    }
    70% {
      transform: rotate(4deg);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .spark {
      animation: flicker 0.35s ease-in-out infinite;
    }

    .spark-2 {
      animation-delay: 0.1s;
    }

    .spark-3 {
      animation-delay: 0.2s;
    }

    .urgent {
      animation: jiggle 0.4s ease-in-out infinite;
    }

    .stick {
      transition: x2 1s linear;
    }
  }
</style>
