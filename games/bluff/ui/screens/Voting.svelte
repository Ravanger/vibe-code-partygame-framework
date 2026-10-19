<script lang="ts">
import { Timer } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { VotingViewModel } from "../viewmodels/VotingViewModel.svelte.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new VotingViewModel(manager));
</script>

<div class="voting stack">
  <p class="round">{vm.roundLabel}</p>
  <h1 class="prompt">{vm.prompt || "…"}</h1>
  <Timer seconds={vm.secondsLeft} total={vm.totalSeconds} announcement={vm.announcement} />

  {#if manager.isSpectator}
    <p class="watching">Watch the votes land.</p>
  {:else if vm.voted}
    <p class="watching">Vote locked in. Waiting for the others…</p>
  {:else}
    <ul class="choices">
      {#each vm.choices as choice (choice.id)}
        <li>
          <button
            type="button"
            class="btn btn--ghost choice"
            disabled={choice.isMine}
            onclick={() => void vm.vote(choice.id)}
          >
            <span class="text">{choice.text}</span>
            {#if choice.isMine}<span class="chip">yours</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="progress" role="status">{`${vm.votesCast}/${vm.votesExpected} votes in`}</p>
</div>

<style>
.voting {
  gap: 1rem;
}

.round {
  margin: 0;
  opacity: 0.7;
}

.prompt {
  margin: 0;
  font-size: clamp(1.4rem, 3.5vw, 2.2rem);
}

.choices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.choice {
  width: 100%;
  justify-content: space-between;
  text-align: left;
  font-size: 1.05rem;
}

.text {
  flex: 1;
}

.progress {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.watching {
  margin: 0;
  opacity: 0.8;
}
</style>
