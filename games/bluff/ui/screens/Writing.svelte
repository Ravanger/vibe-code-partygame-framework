<script lang="ts">
import { ActionBar, PlayerSticker, Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { WritingViewModel } from "../viewmodels/WritingViewModel.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new WritingViewModel(manager));
let text = $state("");

async function submit(): Promise<void> {
  const value = text.trim();
  if (value === "") return;
  await vm.submit(value);
  text = "";
}
</script>

<div class="writing stack">
  <p class="round">{vm.roundLabel}</p>
  <h1 class="prompt">{vm.prompt || "…"}</h1>
  <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />

  <ul class="writers">
    {#each vm.rows as row (row.id)}
      <li class:done={row.done} class:me={row.isMe}>
        <PlayerSticker name={row.name} playerId={row.id} size={28} />
        <span class="name">{row.name}</span>
        {#if row.done}<span class="chip chip--paper">wrote it</span>{/if}
      </li>
    {/each}
  </ul>

  {#if manager.isSpectator}
    <p class="watching">Watch the fakes come in.</p>
  {:else if vm.myDone}
    <p class="watching">Your fake is in. Now wait for the others…</p>
  {:else}
    <ActionBar>
      <textarea
        bind:value={text}
        maxlength={200}
        rows={2}
        placeholder="Write a fake answer…"
        onkeydown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      ></textarea>
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

.round {
  margin: 0;
  opacity: 0.7;
}

.prompt {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
}

.writers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.writers li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name {
  flex: 1;
}

.me .name {
  font-weight: 700;
}

textarea {
  width: 100%;
  resize: none;
}

.watching {
  margin: 0;
  opacity: 0.8;
}
</style>
