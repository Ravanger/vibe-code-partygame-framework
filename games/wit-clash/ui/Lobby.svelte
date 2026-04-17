<script lang="ts">
import type { GameConnectionManager } from "@partygame/client/src/connection.svelte.js";

let gameCode = $state("");
let playerName = $state("");
let _error = $state("");

const { manager, createGameOnLoad = false } = $props<{
  manager: GameConnectionManager;
  createGameOnLoad?: boolean;
}>();

// biome-ignore lint/suspicious/noExplicitAny: state is proxy
const state = $derived(manager.room?.state as any);
// biome-ignore lint/suspicious/noExplicitAny: players are proxies
const players = $derived(state?.players ? (Array.from(state.players.values()) as any[]) : []);
const localPlayer = $derived(players.find((p) => p.id === manager.room?.sessionId));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const isHost = $derived(localPlayer?.role === "host");

$effect(() => {
  if (createGameOnLoad && manager.connectionStatus === "disconnected") {
    console.log("[Lobby] auto-creating game...");
    manager.create("wit_clash");
  }
});

const _createGame = async () => {
  _error = "";
  try {
    await manager.create("wit_clash");
  } catch (e) {
    _error = `Failed to create game: ${e}`;
  }
};

const _joinGame = async () => {
  if (!gameCode.trim()) {
    _error = "Please enter a valid game code.";
    return;
  }
  _error = "";
  try {
    await manager.join("wit_clash", { code: gameCode });
  } catch (e) {
    _error = `Failed to join game: ${e}`;
  }
};

const _setName = () => {
  if (!playerName.trim()) {
    _error = "Please enter your name.";
    return;
  }
  _error = "";
  manager.room?.send("SET_NAME", playerName);
};

const _startGame = () => {
  manager.room?.send("ACTION", { type: "START_GAME" });
};
</script>

<div class="lobby">
  <h2>WitClash</h2>

  {#if manager.connectionStatus === 'disconnected'}
    <div class="step join-step">
      <div class="card">
        <h3>Join a Game</h3>
        <input 
          type="text" 
          value={gameCode} 
          oninput={(e) => gameCode = (e.target as HTMLInputElement).value.toUpperCase()} 
          placeholder="Enter 4-letter code" 
          maxlength="4"
        />
        <button class="join-btn" onclick={_joinGame}>Join Game</button>
      </div>
      
      <div class="divider">OR</div>
      
      <div class="card">
        <h3>Host a New Game</h3>
        <button class="create-btn" onclick={_createGame}>Create Game</button>
      </div>
      
      {#if _error}<p class="error">{_error}</p>{/if}
    </div>

  {:else if manager.connectionStatus === 'connecting'}
    <div class="step loading-step">
      <p>Connecting to game server...</p>
    </div>

  {:else if manager.connectionStatus === 'connected'}
    {#if !localPlayer?.isReady}
      <div class="step name-step">
        <div class="card">
          <h3>Welcome!</h3>
          <p>You joined room: <strong>{state?.roomCode}</strong></p>
          <input 
            type="text" 
            value={playerName} 
            oninput={(e) => playerName = (e.target as HTMLInputElement).value} 
            placeholder="Enter your nickname" 
          />
          <button class="ready-btn" onclick={_setName}>Join Lobby</button>
          {#if _error}<p class="error">{_error}</p>{/if}
        </div>
      </div>
    {:else}
      <div class="step waiting-step">
        <div class="room-info">
          <p>Game Code: <span class="room-code">{state?.roomCode}</span></p>
        </div>

        <div class="card players-card">
          <h3>Players ({players.filter((p: any) => p.isReady).length})</h3>
          <ul class="player-list">
            {#each players.filter((p: any) => p.isReady) as player}
              <li class={player.id === manager.room?.sessionId ? 'current-player' : ''}>
                {player.name} {player.id === manager.room?.sessionId ? '(You)' : ''}
                {#if player.role === 'host'} <span class="host-badge">Host</span> {/if}
              </li>
            {/each}
          </ul>
        </div>

        <div class="controls">
          {#if isHost}
            <div class="host-controls">
              <button class="start-button" onclick={_startGame} disabled={players.filter((p: any) => p.isReady).length < 3}>
                Start Game
              </button>
              {#if players.filter((p: any) => p.isReady).length < 3}
                <p class="hint">Need at least 3 players to start</p>
              {/if}
            </div>
          {:else}
            <p class="waiting-msg">Waiting for host to start...</p>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .lobby { padding: 20px; max-width: 500px; margin: 0 auto; text-align: center; }
  .step { display: flex; flex-direction: column; gap: 20px; animation: fadeIn 0.3s ease-out; }
  .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 15px; }
  
  h2 { color: #333; margin-bottom: 30px; font-size: 2.5rem; letter-spacing: -1px; }
  h3 { margin: 0; color: #444; }
  
  input { padding: 12px; font-size: 1.1rem; border: 2px solid #eee; border-radius: 8px; transition: border-color 0.2s; }
  input:focus { outline: none; border-color: #2196F3; }
  
  button { padding: 14px; font-size: 1.1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: transform 0.1s, background 0.2s; }
  button:active { transform: scale(0.98); }
  button:disabled { background: #eee !important; color: #aaa; cursor: not-allowed; }
  
  .join-btn { background: #4CAF50; color: white; }
  .create-btn { background: #9c27b0; color: white; }
  .ready-btn { background: #2196F3; color: white; }
  .start-button { background: #ff5722; color: white; padding: 16px 32px; font-size: 1.3rem; }
  
  .divider { color: #888; font-weight: bold; font-size: 0.9rem; }
  .error { color: #f44336; font-weight: 500; }
  
  .room-info { margin-bottom: 10px; }
  .room-code { font-family: monospace; font-size: 2rem; background: #eee; padding: 4px 12px; border-radius: 6px; font-weight: bold; color: #333; }
  
  .player-list { list-style: none; padding: 0; text-align: left; }
  .player-list li { padding: 10px 15px; background: #f5f5f5; margin-bottom: 8px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; }
  .player-list li.current-player { background: #e3f2fd; border: 1px solid #2196F3; }
  .host-badge { background: #ffd700; color: #333; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
  
  .hint { font-size: 0.85rem; color: #777; margin-top: 8px; }
  .waiting-msg { font-style: italic; color: #666; margin-top: 20px; font-size: 1.1rem; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
