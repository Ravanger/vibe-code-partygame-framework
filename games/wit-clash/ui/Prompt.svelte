<script lang="ts">
import type { GameConnectionManager } from "@partygame/client/src/connection.js";
const _props = $props<{ manager: GameConnectionManager }>();
const _answer = $state("");
</script>

<div class="prompt">
  <h2>{props.manager.connectionStatus === 'connected' ? 'Answer the Prompt!' : 'Connecting...'}</h2>
  <div class="input-group">
    <input 
      bind:value={_answer} 
      placeholder="Type something funny..." 
      onkeydown={(e) => e.key === 'Enter' && props.manager.room?.send("ACTION", { type: "SubmitAnswer", answer: _answer })}
    />
    <button onclick={() => props.manager.room?.send("ACTION", { type: "SubmitAnswer", answer: _answer })}>Submit</button>
  </div>
</div>


<style>
  .prompt { padding: 20px; text-align: center; }
  .input-group { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
  input { padding: 10px; font-size: 1rem; flex: 1; max-width: 300px; }
  button { padding: 10px 20px; background: #2196F3; color: white; border: none; cursor: pointer; }
</style>

