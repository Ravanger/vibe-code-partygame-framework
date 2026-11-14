<script lang="ts">
import { plural } from "@partygame/game-ui";
import { ChoiceBoard, PhaseTimer, ScreenTitle } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { BluffManager } from "../manager.js";
import { VotingViewModel } from "../viewmodels/VotingViewModel.svelte.js";

const { manager }: { manager: BluffManager } = $props();

const vm = untrack(() => new VotingViewModel(manager));
</script>

<div class="voting stack">
  <ScreenTitle title={vm.prompt || "…"} hint={vm.roundLabel} />
  <PhaseTimer clock={vm.clock} />

  {#if manager.isSpectator}
    <p class="watching">Watch the votes land.</p>
  {:else}
    <ChoiceBoard choices={vm.choices} canVote={!vm.voted} onvote={(id) => void vm.vote(id)} />
  {/if}

  <p class="progress" role="status">{`${vm.votesCast}/${vm.votesExpected} ${plural(vm.votesExpected, "vote")} in`}</p>
</div>

<style>
.voting {
  gap: 1rem;
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
