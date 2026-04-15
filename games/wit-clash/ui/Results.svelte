<script lang="ts">
import type { GameClient } from "@partygame/client";
const { client: _client } = $props<{ client: GameClient }>();
</script>

<div class="results">
  <h2>Results</h2>
  <div class="scoreboard">
    <!-- Scoreboard logic goes here -->
  </div>
  <button 
    class="play-again" 
    onclick={() => client.send('ACTION', { name: 'PLAY_AGAIN', data: {} })}
  >
    Play Again
  </button>
</div>

<style>
  .results { padding: 20px; text-align: center; }
  .play-again { padding: 10px 20px; font-size: 1.2rem; background: #9C27B0; color: white; border: none; cursor: pointer; border-radius: 4px; margin-top: 20px; }
  .play-again:hover { background: #7B1FA2; }
</style>
