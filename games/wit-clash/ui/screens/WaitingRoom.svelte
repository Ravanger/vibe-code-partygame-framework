<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { WaitingRoomViewModel } from "../viewmodels/WaitingRoomViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

const vm = new WaitingRoomViewModel(manager);

$effect(() => {
  return () => vm.destroy();
});
</script>

<div class="waiting-room">
  <div class="room-info">
    <p>Room Code</p>
    <div class="room-code-display">
      <span class="room-code">{vm.roomCode}</span>
      <button class="copy-btn" on:click={() => vm.copyCode()}>Copy</button>
    </div>
    <p class="share-instructions">
      Share this link:
      <code>{vm.shareUrl}</code>
    </p>
  </div>

  <div class="players-section">
    <h3>Players ({vm.players.length}/{vm.minPlayers}+)</h3>
    <ul class="player-list">
      {#each vm.players as player}
        <li class:current-player={player.id === vm.localPlayer?.id} class:disconnected={!player.isConnected}>
          <span class="player-name">{player.name ?? "Unknown"}</span>
          <div class="badges">
            {#if player.id === vm.localPlayer?.id}
              <span class="you-badge">(You)</span>
            {/if}
            {#if player.role === "host"}
              <span class="host-badge">Host</span>
            {/if}
            {#if !player.isConnected}
              <span class="disconnected-badge">(Disconnected)</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <div class="your-name">
    <label>Your name</label>
    <input
      type="text"
      placeholder="Enter your name"
      maxlength="20"
      value={vm.draftName}
      on:input={(e) => vm.setName((e.target as HTMLInputElement).value)}
    />
  </div>

  {#if vm.isHost}
    <div class="host-controls">
      <button class="start-btn" disabled={!vm.canStart} on:click={() => vm.start()}>
        Start Game ({vm.readyCount}/{vm.minPlayers})
      </button>
      {#if vm.readyCount < vm.minPlayers}
        <p class="hint">Need at least {vm.minPlayers} players to start</p>
      {/if}
    </div>
  {:else}
    <p class="waiting-msg">Waiting for host to start the game...</p>
  {/if}
</div>

<style>
  .waiting-room {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .room-info {
    text-align: center;
  }

  .room-info p {
    margin: 0 0 10px;
    color: #666;
  }

  .room-code-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 15px 0;
  }

  .room-code {
    font-family: monospace;
    font-size: 3rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 12px;
    font-weight: bold;
    letter-spacing: 8px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .copy-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #f0f0f0;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .copy-btn:hover {
    background: #e0e0e0;
  }

  .share-instructions {
    font-size: 0.9rem;
    color: #666;
    margin-top: 10px;
  }

  .share-instructions code {
    background: #f5f5f5;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }

  .players-section {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .players-section h3 {
    margin: 0 0 15px;
    color: #444;
  }

  .player-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .player-list li {
    padding: 10px 14px;
    background: #f5f5f5;
    margin-bottom: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .player-list li.current-player {
    background: #e3f2fd;
    border: 2px solid #2196F3;
  }

  .player-list li.disconnected {
    opacity: 0.6;
    background: #fff3e0;
  }

  .player-name {
    font-weight: 500;
  }

  .badges {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
  }

  .you-badge {
    color: #2196F3;
    font-size: 0.85rem;
    font-weight: bold;
  }

  .host-badge {
    background: #ffd700;
    color: #333;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: bold;
  }

  .disconnected-badge {
    color: #f57c00;
    font-size: 0.8rem;
  }

  .your-name {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .your-name label {
    font-size: 0.9rem;
    color: #666;
  }

  .your-name input {
    padding: 10px 14px;
    font-size: 1rem;
    border: 2px solid #eee;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .your-name input:focus {
    outline: none;
    border-color: #2196F3;
  }

  .host-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .start-btn {
    padding: 14px 32px;
    font-size: 1.2rem;
    border: none;
    border-radius: 8px;
    background: #ff5722;
    color: white;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.1s, background 0.2s;
  }

  .start-btn:active {
    transform: scale(0.98);
  }

  .start-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.85rem;
    color: #777;
    margin: 0;
  }

  .waiting-msg {
    text-align: center;
    font-style: italic;
    color: #666;
    font-size: 1.1rem;
    margin-top: 10px;
  }
</style>
