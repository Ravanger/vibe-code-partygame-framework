<script lang="ts">
import { getStrings } from "../strings.js";

const {
  value,
  label,
  maxLength,
  remaining,
  oninput,
  onsubmit,
  placeholder = "",
  rejection = "",
}: {
  value: string;
  label: string;
  maxLength: number;
  remaining: number;
  oninput: (value: string) => void;
  onsubmit: () => void;
  placeholder?: string;
  rejection?: string;
} = $props();
const strings = getStrings();

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    onsubmit();
  }
}
</script>

{#if rejection !== ""}
  <p class="rejection" role="alert">{rejection}</p>
{/if}

<div class="draft-box">
  <textarea
    aria-label={label}
    enterkeyhint="send"
    maxlength={maxLength}
    placeholder={placeholder || undefined}
    {value}
    oninput={(e) => oninput(e.currentTarget.value)}
    onkeydown={handleKeydown}
  ></textarea>
  <span class="counter chip" class:low={remaining < 20}>{strings.charsLeft(remaining)}</span>
</div>

<style>
  .draft-box {
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
    background: var(--color-1);
  }

  .rejection {
    margin: 0 0 0.5rem;
    color: var(--danger);
    font-size: var(--fs-3);
    text-align: center;
  }
</style>
