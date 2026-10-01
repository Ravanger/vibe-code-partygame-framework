<script lang="ts">
import { untrack } from "svelte";
import LobbySettings from "../components/LobbySettings.svelte";
import NameInput from "../components/NameInput.svelte";
import QrCode from "../components/QrCode.svelte";
import type { WitClashManager } from "../manager.js";
import { WaitingRoomViewModel } from "../viewmodels/WaitingRoomViewModel.svelte.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new WaitingRoomViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="waiting-room">
  {#if vm.notice}
    <p class="notice" role="status">{vm.notice}</p>
  {/if}

  <div class="room-info">
    <p>Room Code</p>
    <div class="room-code-display">
      <span class="room-code">{vm.roomCode}</span>
      {#if !vm.isSpectator}
        <button type="button" class="copy-btn" onclick={() => vm.copyCode()}>Copy</button>
      {/if}
    </div>
    <div class="qr-box">
      <QrCode text={vm.shareUrl} />
    </div>
    <p class="share-instructions">
      Scan to join, or open
      <code>{vm.shareUrl}</code>
    </p>
  </div>

  <div class="players-section">
    <h3>{`Players (${vm.readyCount} ready, ${vm.minPlayers} to ${vm.maxPlayers} needed)`}</h3>
    {#if vm.spectatorCount > 0}
      <p class="watching">{`${vm.spectatorCount} watching on a TV`}</p>
    {/if}
    <ul class="player-list">
      {#each vm.players as player (player.id)}
        <li class:current-player={player.isMe} class:disconnected={!player.isConnected}>
          <span class="player-name">{player.isReady ? player.name : "Choosing a name..."}</span>
          <div class="badges">
            {#if player.isMe}
              <span class="you-badge">(You)</span>
            {/if}
            {#if player.isHost}
              <span class="host-badge">Host</span>
            {/if}
            {#if !player.isConnected}
              <span class="disconnected-badge">(Disconnected)</span>
            {/if}
            {#if vm.canKick(player)}
              {#if vm.kickCandidate === player.id}
                <span class="kick-confirm">Remove?</span>
                <button type="button" class="kick-yes" onclick={() => vm.confirmKick()}>Yes</button>
                <button type="button" class="kick-no" onclick={() => vm.cancelKick()}>No</button>
              {:else}
                <button type="button" class="kick-btn" onclick={() => vm.askKick(player.id)}>
                  {`Remove ${player.name || "player"}`}
                </button>
              {/if}
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <LobbySettings {manager} />

  {#if !vm.isSpectator}
    <NameInput field={vm.nameField} />
  {/if}

  {#if vm.isHost}
    <div class="host-controls">
      <button type="button" class="start-btn" disabled={!vm.canStart} onclick={() => vm.start()}>
        {`Start Game (${vm.readyCount}/${vm.minPlayers})`}
      </button>
      {#if !vm.canStart}
        <p class="hint">{`Need at least ${vm.minPlayers} players to start`}</p>
      {/if}
    </div>
  {:else}
    <p class="waiting-msg">Waiting for the host to start the game...</p>
  {/if}

  <button type="button" class="leave-btn" onclick={() => vm.leave()}>Leave game</button>
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

  .watching {
    margin: 0 0 12px;
    color: #666;
    font-size: 0.9rem;
  }

  .qr-box {
    width: 180px;
    margin: 0 auto;
  }

  .kick-btn,
  .kick-yes,
  .kick-no {
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .kick-btn,
  .kick-no {
    background: #e0e0e0;
  }

  .kick-yes {
    background: #b91c1c;
    color: white;
  }

  .kick-confirm {
    font-size: 0.85rem;
    color: #b91c1c;
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

  .notice {
    margin: 0;
    padding: 10px 16px;
    border-radius: 8px;
    background: #fff3e0;
    color: #e65100;
    text-align: center;
  }

  .leave-btn {
    align-self: center;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #e0e0e0;
    cursor: pointer;
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
