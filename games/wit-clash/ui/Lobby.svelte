<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/src/connection.svelte.js";
import { WitClashGame } from "../index";

let gameCode = $state("");
let playerName = $state("");
let _error = $state("");

// biome-ignore lint/correctness/noUnusedVariables: used in template for min/max players
const mockGameDefinition = WitClashGame;

const { manager, createGameOnLoad = false } = $props<{
  manager: GameConnectionManager;
  createGameOnLoad?: boolean;
}>();

// Check URL for auto-join code parameter
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get("code");

// Access manager.room?.state directly in derived computations so Svelte tracks it
// biome-ignore lint/suspicious/noExplicitAny: room state is a Colyseus proxy
const state = $derived.by(() => manager.room?.state as any);
// biome-ignore lint/suspicious/noExplicitAny: players MapSchema
const players = $derived.by(() => {
  const s = manager.room?.state as any;
  return s?.players ? (Array.from(s.players.values()) as any[]) : [];
});
// biome-ignore lint/suspicious/noExplicitAny: player objects are proxies
const localPlayer = $derived.by(() => {
  const p = players as any[];
  return p.find((player: any) => player.id === manager.room?.sessionId);
});
// biome-ignore lint/correctness/noUnusedVariables: used in template
const isHost = $derived.by(() => localPlayer?.role === "host");

// Debug: log when players change
$effect(() => {
  // biome-ignore lint/suspicious/noExplicitAny: players is proxy array
  console.log(`[Lobby] Players updated:`, players.map((p: any) => ({ id: p.id, name: p.name, isReady: p.isReady })));
});

$effect(() => {
  // Clear error when state changes
  _error = "";

  // Auto-join if code in URL
  if (codeFromUrl && codeFromUrl.match(/^[A-Z]{4}$/) && manager.connectionStatus === "disconnected") {
    console.log("[Lobby] auto-joining with code:", codeFromUrl);
    gameCode = codeFromUrl;
    _joinGame().catch(console.error);
  }
  
  // Auto-create if host mode
  if (createGameOnLoad && manager.connectionStatus === "disconnected") {
    console.log("[Lobby] auto-creating game...");
    _createGame().catch(console.error);
  }
});

const _createGame = async () => {
  _error = "";
  try {
    await manager.create("wit_clash");
    // Wait a brief moment for state to synchronize from server
    await new Promise((resolve) => setTimeout(resolve, 100));
    // After creating, get the room code from state
    gameCode = state?.roomCode || "";
    if (!gameCode) {
      // Try once more with a longer wait
      await new Promise((resolve) => setTimeout(resolve, 200));
      gameCode = state?.roomCode || "";
    }
  } catch (e) {
    _error = `Failed to create game: ${(e as Error)?.message || String(e)}`;
  }
};

const _joinGame = async () => {
  if (!gameCode.trim()) {
    _error = "Please enter a valid game code.";
    return;
  }
  if (!/^[A-Z]{4}$/.test(gameCode)) {
    _error = "Game code must be 4 uppercase letters (A-Z).";
    return;
  }
  _error = "";
  try {
    console.log(`[Lobby] Attempting to join game with code: ${gameCode}`);
    await manager.joinByCode(gameCode);
    console.log(`[Lobby] Successfully joined game with code: ${gameCode}`);
  } catch (e) {
    console.error(`[Lobby] Failed to join game with code ${gameCode}:`, e);
    _error = `Failed to join game: ${(e as Error)?.message || String(e)}`;
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
          bind:value={gameCode}
          placeholder="Enter 4-letter code"
          maxlength="4"
          oninput={(e) => {
            const input = (e.target as HTMLInputElement).value;
            gameCode = input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
          }}
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
          <p>You joined room: <strong>{state?.roomCode || '...'}</strong></p>
          <input 
            type="text" 
            bind:value={playerName}
            placeholder="Enter your nickname"
          />
          <button class="ready-btn" onclick={_setName}>Join Lobby</button>
          {#if _error}<p class="error">{_error}</p>{/if}
        </div>
      </div>
    {:else}
      <div class="step waiting-step">
        <div class="room-info">
          <p>Your Room Code:</p>
          <div class="room-code-display">
            <span class="room-code">{state?.roomCode}</span>
          </div>
          <p class="share-instructions">
            Share this code with players to join:
            <br />
            <code>http://{window.location.host}{window.location.pathname}?code={state?.roomCode}</code>
          </p>
        </div>

        <div class="card players-card">
          <h3>Players ({players.filter((p: any) => p.isReady).length}/{mockGameDefinition?.maxPlayers || 8})</h3>
          <ul class="player-list">
            {#each players.filter((p: any) => p.isReady) as player}
              <li class={player.id === manager.room?.sessionId ? 'current-player' : ''}>
                <span class="player-name">{player.name}</span>
                {#if player.id === manager.room?.sessionId}
                  <span class="you-badge">(You)</span>
                {/if}
                {#if player.role === 'host'}
                  <span class="host-badge">{player.role === 'host' ? 'Host' : ''}</span>
                {/if}
              </li>
            {/each}
            {#if players.filter((p: any) => p.isReady).length === 0}
              <li class="empty-message">No players yet - share your room code!</li>
            {/if}
          </ul>
        </div>

        <div class="controls">
          {#if isHost}
            <div class="host-controls">
              <button 
                class="start-button" 
                onclick={_startGame} 
                disabled={players.filter((p: any) => p.isReady).length < (mockGameDefinition?.minPlayers || 3)}
              >
                Start Game ({players.filter((p: any) => p.isReady).length}/{mockGameDefinition?.minPlayers || 3})
              </button>
              {#if players.filter((p: any) => p.isReady).length < (mockGameDefinition?.minPlayers || 3)}
                <p class="hint">Need at least {mockGameDefinition?.minPlayers || 3} players to start</p>
              {/if}
            </div>
          {:else}
            <p class="waiting-msg">Waiting for host to start the game...</p>
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
  
  input { padding: 12px; font-size: 1.1rem; border: 2px solid #eee; border-radius: 8px; transition: border-color 0.2s; text-align: center; font-family: monospace; font-size: 1.5rem; letter-spacing: 4px; }
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
  
  .room-info { margin-bottom: 20px; }
  .room-code-display { margin: 20px 0; }
  .room-code { font-family: monospace; font-size: 3rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 25px; border-radius: 12px; font-weight: bold; display: inline-block; text-shadow: 0 2px 4px rgba(0,0,0,0.2); letter-spacing: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
  .share-instructions { font-size: 0.9rem; color: #666; margin-top: 15px; }
  .share-instructions code { background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; word-break: break-all; }
  
  .player-list { list-style: none; padding: 0; text-align: left; }
  .player-list li { padding: 12px 16px; background: #f5f5f5; margin-bottom: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; }
  .player-list li:hover { transform: translateX(5px); }
  .player-list li.current-player { background: #e3f2fd; border: 2px solid #2196F3; }
  .player-list li.empty-message { background: transparent; color: #888; font-style: italic; justify-content: center; }
  .player-name { font-weight: 500; }
  .you-badge { color: #2196F3; font-size: 0.85rem; font-weight: bold; }
  .host-badge { background: #ffd700; color: #333; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
  
  .hint { font-size: 0.85rem; color: #777; margin-top: 8px; }
  .waiting-msg { font-style: italic; color: #666; margin-top: 20px; font-size: 1.1rem; }
  
  .controls { margin-top: 10px; }
  
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  
  @media (max-width: 600px) {
    .room-code { font-size: 2rem; padding: 10px 20px; }
  }
</style>
