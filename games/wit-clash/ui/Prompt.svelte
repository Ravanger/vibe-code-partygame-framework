<script lang="ts">
import type { GameClient } from "@partygame/client";
const { client: _client } = $props<{ client: GameClient }>();
const _answer = $state("");

function _submit() {
  _client.send("ACTION", { name: "SUBMIT_ANSWER", data: { text: _answer } });
}
</script>

<div class="prompt">
  <h2>Answer the Prompt!</h2>
  <div class="input-group">
    <input 
      bind:value={_answer} 
      placeholder="Type something funny..." 
      onkeydown={(e) => e.key === 'Enter' && _submit()}
    />
    <button onclick={_submit}>Submit</button>
  </div>
</div>

<style>
  .prompt { padding: 20px; text-align: center; }
  .input-group { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
  input { padding: 10px; font-size: 1rem; flex: 1; max-width: 300px; }
  button { padding: 10px 20px; background: #2196F3; color: white; border: none; cursor: pointer; }
</style>
