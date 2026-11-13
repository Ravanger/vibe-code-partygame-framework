<script lang="ts">
import { ActionBar, DraftBox, PhaseTimer, ProgressStrip, ScreenTitle } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import { ANSWER_MAX_LENGTH } from "../../src/actionNames.js";
import type { BluffManager } from "../manager.js";
import { WritingViewModel } from "../viewmodels/WritingViewModel.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new WritingViewModel(manager));
let text = $state("");

async function submit(): Promise<void> {
  const value = text.trim();
  if (value === "") return;
  const accepted = await vm.submit(value);
  if (accepted) text = "";
}
</script>

<div class="writing stack">
  <ScreenTitle title={vm.prompt || "…"} hint={vm.roundLabel} />
  <PhaseTimer clock={vm.clock} />

  <ProgressStrip rows={vm.rows} label="Writers" />

  {#if manager.isSpectator}
    <p class="watching">Watch the fakes come in.</p>
  {:else if vm.myDone}
    <p class="watching">Your fake is in. Now wait for the others…</p>
  {:else}
    <DraftBox
      value={text}
      label="Your answer"
      maxLength={ANSWER_MAX_LENGTH}
      remaining={ANSWER_MAX_LENGTH - text.length}
      oninput={(value) => {
        text = value;
      }}
      onsubmit={() => void submit()}
      placeholder="Write a fake answer…"
      rejection={vm.rejectionReason}
    />
    <ActionBar>
      <button
        type="button"
        class="btn btn--primary btn--big"
        disabled={text.trim().length === 0}
        onclick={() => void submit()}
      >
        Lock it in
      </button>
    </ActionBar>
  {/if}
</div>

<style>
.writing {
  gap: 1rem;
}

.watching {
  margin: 0;
  opacity: 0.8;
}
</style>
