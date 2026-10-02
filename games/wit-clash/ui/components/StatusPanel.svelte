<script lang="ts">
const {
  title,
  detail = "",
  tone,
}: { title: string; detail?: string; tone: "wait" | "done" | "info" } = $props();
</script>

<div class={`status-panel card taped tone-${tone}`}>
  {#if tone === "done"}
    <span class="sticker done-sticker" aria-hidden="true">&#10003; Done</span>
  {/if}
  <p class="title">{title}</p>
  {#if detail}
    <p class="detail hand">{detail}</p>
  {/if}
  {#if tone === "wait"}
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
  {/if}
</div>

<style>
  .status-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    text-align: center;
  }

  .tone-info {
    --tape: var(--tape-sky);
  }

  .tone-done {
    --tape: var(--tape-mint);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: calc(var(--fs-4) * var(--scale, 1));
    line-height: 1.2;
  }

  .detail {
    margin: 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .done-sticker {
    background: var(--mint);
  }

  .dots {
    display: inline-flex;
    gap: 8px;
  }

  .dots i {
    width: 12px;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--pink);
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-7px);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .dots i {
      animation: bounce 0.9s ease-in-out infinite;
    }

    .dots i:nth-child(2) {
      animation-delay: 0.15s;
    }

    .dots i:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
</style>
