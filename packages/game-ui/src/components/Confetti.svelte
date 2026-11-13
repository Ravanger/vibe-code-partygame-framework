<script lang="ts">
  /** How many pieces to render. */
  const { count }: { count: number } = $props();

  const COLORS = [
    "var(--color-1)",
    "var(--color-2)",
    "var(--color-3)",
    "var(--color-4)",
    "var(--accent)",
  ];

  /** The deterministic geometry and colour of every piece. */
  const pieces = $derived(
    Array.from({ length: count }, (_, index) => {
      const [color = ""] = COLORS.slice(index % COLORS.length);
      return {
        left: (index * 37) % 100,
        delay: ((index * 13) % 17) / 10,
        duration: 2.2 + ((index * 7) % 9) / 10,
        drift: ((index * 11) % 21) - 10,
        color,
      };
    }),
  );
</script>

<div class="confetti" aria-hidden="true">
  {#each pieces as piece}
    <i
      style:left={`${piece.left}%`}
      style:animation-delay={`${piece.delay}s`}
      style:animation-duration={`${piece.duration}s`}
      style:--drift={`${piece.drift}vw`}
      style:background={piece.color}
    ></i>
  {/each}
</div>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 20;
  }

  .confetti i {
    display: none;
    position: absolute;
    top: -3vh;
    width: 10px;
    height: 16px;
    border: 2px solid var(--ink);
  }

  @keyframes fall {
    from {
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    to {
      transform: translate(var(--drift), 108vh) rotate(720deg);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .confetti i {
      display: block;
      animation: fall linear 1 both;
    }
  }
</style>
