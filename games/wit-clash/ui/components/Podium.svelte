<script lang="ts">
import type { PodiumStep } from "../viewmodels/Podium.js";

const { steps }: { steps: PodiumStep[] } = $props();
</script>

{#if steps.length > 0}
  <ol class="podium" aria-label="Podium">
    {#each steps as step (step.rank)}
      <li class={`step place-${step.rank}`}>
        <div class="occupants">
          {#each step.players as player (player.playerId)}
            <div class="occupant" class:is-me={player.isMe}>
              <span class="occupant-name">{player.name}</span>
              {#if player.wonTieBreaker}
                <span class="tie-badge">Won the tie-breaker</span>
              {/if}
              <span class="occupant-score">{`${player.score} pts`}</span>
            </div>
          {/each}
        </div>
        <div class="block">{step.label}</div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .podium {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 8px;
  }

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
  }

  .occupants {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .occupant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .occupant-name {
    font-weight: 700;
    font-size: 1.1rem;
  }

  .occupant.is-me .occupant-name {
    color: #667eea;
  }

  .occupant-score {
    color: #666;
    font-variant-numeric: tabular-nums;
  }

  .tie-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .tie-badge {
    background: #7c3aed;
    color: white;
  }

  .block {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8px;
    border-radius: 12px 12px 0 0;
    font-size: 1.6rem;
    font-weight: 800;
    color: white;
    background: linear-gradient(180deg, #667eea 0%, #7c3aed 100%);
  }

  .place-1 .block {
    height: 140px;
    background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
  }

  .place-2 .block {
    height: 100px;
  }

  .place-3 .block {
    height: 70px;
    background: linear-gradient(180deg, #b45309 0%, #92400e 100%);
  }

  :global(main.tv) .occupant-name {
    font-size: 2.4rem;
  }

  :global(main.tv) .occupant-score {
    font-size: 1.8rem;
  }

  :global(main.tv) .tie-badge {
    font-size: 1.2rem;
  }

  :global(main.tv) .place-1 .block {
    height: 260px;
    font-size: 3rem;
  }

  :global(main.tv) .place-2 .block {
    height: 190px;
    font-size: 3rem;
  }

  :global(main.tv) .place-3 .block {
    height: 130px;
    font-size: 3rem;
  }
</style>
