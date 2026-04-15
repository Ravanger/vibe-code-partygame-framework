<script lang="ts">
import type { GameClient } from "@partygame/client";
const { client } = $props<{ client: GameClient }>();

// In a real app, this would come from visibility-filtered state
const _options = $derived(JSON.parse(client.state.publicData).votingOptions || []);
</script>

<div class="vote">
  <h2>Vote!</h2>
  <div class="options">
    {#each options as option}
      <button 
        class="option" 
        onclick={() => client.send('ACTION', { name: 'VOTE', data: { answerId: option.id } })}
      >
        {option.text}
      </button>
    {:else}
      <p>Waiting for others to finish answering...</p>
    {/each}
  </div>
</div>

<style>
  .vote { padding: 20px; text-align: center; }
  .options { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 20px; }
  .option { padding: 15px 30px; font-size: 1.1rem; width: 100%; max-width: 400px; background: #FF9800; color: white; border: none; cursor: pointer; border-radius: 8px; }
  .option:hover { background: #F57C00; }
</style>
