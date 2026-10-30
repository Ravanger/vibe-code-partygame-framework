<script lang="ts">
import type { NameField } from "@partygame/game-ui";
import { NAME_MAX_LENGTH } from "@partygame/shared";
import { getStrings } from "../strings.js";
import { nextId } from "./uniqueId.js";

const inputId = nextId("playerName");

const { field, focus = false }: { field: NameField; focus?: boolean } = $props();
const strings = getStrings();

function takeFocus(node: HTMLInputElement): void {
  if (focus) node.focus();
}
</script>

<div class="your-name card taped">
  <label for={inputId}>{strings.yourName}</label>
  <input
    id={inputId}
    type="text"
    placeholder={strings.enterYourName}
    maxlength={NAME_MAX_LENGTH}
    autocomplete="nickname"
    value={field.draft}
    oninput={(e) => field.set(e.currentTarget.value)}
    use:takeFocus
  />
</div>

<style>
  .your-name {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  input {
    min-height: 52px;
    padding: 0 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-btn);
    background: var(--paper);
    color: var(--ink);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }
</style>
