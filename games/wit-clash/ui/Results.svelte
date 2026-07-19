<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/src/connection.svelte.js";

const { manager } = $props<{ manager: GameConnectionManager }>();

const publicData = $derived(() => {
  try {
    return JSON.parse(manager.room?.state?.publicData ?? "{}");
  } catch {
    return {};
  }
});

const scores = $derived((publicData.scores as Record<string, number>) ?? {});
const _sortedPlayers = $derived(Object.entries(scores).sort(([, a], [, b]) => b - a));
</script>

<div class="results">
  <h2>Final Scores</h2>
  <div class="scoreboard">
    {#if _sortedPlayers.length > 0}
      <table class="scores-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {#each _sortedPlayers as [player, score], i}
            <tr>
              <td>{i + 1}</td>
              <td>{player}</td>
              <td>{score} pts</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="no-scores">No scores yet. Finish a round to see results!</p>
    {/if}
  </div>
  <button 
    class="play-again" 
    onclick={() => manager.room?.send('ACTION', { type: 'PLAY_AGAIN' })}
  >
    Play Again
  </button>
</div>

<style>
  .results { padding: 20px; text-align: center; }
  .scoreboard { margin: 30px 0; }
  .scores-table { margin: 0 auto; border-collapse: collapse; font-size: 1.2rem; }
  .scores-table th, .scores-table td { padding: 12px 20px; text-align: left; }
  .scores-table th { background: #f5f5f5; font-weight: bold; }
  .scores-table tr:nth-child(even) { background: #f9f9f9; }
  .scores-table tr:hover { background: #f0f0f0; }
  .no-scores { color: #666; font-style: italic; }
  .play-again { padding: 10px 20px; font-size: 1.2rem; background: #9C27B0; color: white; border: none; cursor: pointer; border-radius: 4px; margin-top: 20px; }
  .play-again:hover { background: #7B1FA2; }
</style>
