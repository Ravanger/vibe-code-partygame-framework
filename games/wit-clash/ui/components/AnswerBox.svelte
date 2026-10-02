<script lang="ts">
const {
  value,
  remaining,
  oninput,
  onsubmit,
}: {
  value: string;
  remaining: number;
  oninput: (value: string) => void;
  onsubmit: () => void;
} = $props();

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    onsubmit();
  }
}
</script>

<div class="answer-box">
  <textarea
    placeholder="Type your answer..."
    aria-label="Your answer"
    maxlength="200"
    {value}
    oninput={(e) => oninput(e.currentTarget.value)}
    onkeydown={handleKeydown}
  ></textarea>
  <span class="counter chip" class:low={remaining < 20}>{`${remaining} chars left`}</span>
</div>

<style>
  .answer-box {
    position: relative;
  }

  textarea {
    display: block;
    width: 100%;
    min-height: 7.5rem;
    padding: 0.9rem 1rem 2.4rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--white);
    box-shadow: var(--scrap-shadow);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-3);
    resize: vertical;
  }

  .counter {
    position: absolute;
    right: 0.6rem;
    bottom: 0.6rem;
    background: var(--paper);
  }

  .counter.low {
    background: var(--pink);
  }
</style>
