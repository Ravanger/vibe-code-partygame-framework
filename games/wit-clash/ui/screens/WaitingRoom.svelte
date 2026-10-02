<script lang="ts">
import { WaitingRoomViewModel } from "@partygame/game-ui";
import { untrack } from "svelte";
import ActionBar from "../components/ActionBar.svelte";
import LobbySettings from "../components/LobbySettings.svelte";
import NameInput from "../components/NameInput.svelte";
import PlayerSticker from "../components/PlayerSticker.svelte";
import QrCode from "../components/QrCode.svelte";
import StatusPanel from "../components/StatusPanel.svelte";
import type { WitClashManager } from "../manager.js";

const { manager }: { manager: WitClashManager } = $props();

const vm = untrack(() => new WaitingRoomViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="waiting-room">
  <div class="col">
    {#if vm.notice}
      <p class="notice" role="status">{vm.notice}</p>
    {/if}

    {#if vm.nameFirst && !vm.isSpectator}
      <NameInput field={vm.nameField} focus />
    {/if}

    {#if vm.showJoinInfo}
      <div class="room-info card taped">
        <p class="caption">Room Code</p>
        <div class="room-code-display">
          <span class="room-code">{vm.roomCode}</span>
          {#if !vm.isSpectator}
            <button type="button" class="btn btn--secondary" onclick={() => vm.copyCode()}>Copy</button>
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
    {/if}

    {#if vm.showWaitingPanel}
      <StatusPanel tone="wait" title="Waiting for the host to start the game..." />
    {/if}
  </div>

  <div class="col">
    <div class="players-section card">
      <h2>{`Players (${vm.readyCount} ready, ${vm.minPlayers} to ${vm.maxPlayers} needed)`}</h2>
      {#if vm.spectatorCount > 0}
        <p class="watching hand">{`${vm.spectatorCount} watching on a TV`}</p>
      {/if}
      <ul class="player-list">
        {#each vm.players as player (player.id)}
          <li class:current-player={player.isMe} class:disconnected={!player.isConnected}>
            <PlayerSticker name={player.name} playerId={player.id} ghost={!player.isReady} size={48} />
            <span class="player-name">{player.isReady ? player.name : "Choosing a name..."}</span>
            <div class="badges">
              {#if player.isMe}
                <span class="chip chip--sky">(You)</span>
              {/if}
              {#if player.isHost}
                <span class="chip"><span aria-hidden="true">&#128081;</span> Host</span>
              {/if}
              {#if !player.isConnected}
                <span class="chip chip--paper">(Disconnected)</span>
              {/if}
              {#if vm.canKick(player)}
                {#if vm.kickCandidate === player.id}
                  <span class="kick-confirm">Remove?</span>
                  <button type="button" class="btn btn--danger" onclick={() => vm.confirmKick()}>Yes</button>
                  <button type="button" class="btn" onclick={() => vm.cancelKick()}>No</button>
                {:else}
                  <button
                    type="button"
                    class="btn kick-btn"
                    aria-label={`Remove ${player.name || "player"}`}
                    onclick={() => vm.askKick(player.id)}
                  >&#10005;</button>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>

    {#if !vm.nameFirst && !vm.isSpectator}
      <NameInput field={vm.nameField} />
    {/if}

    <LobbySettings {manager} />
  </div>

  <button type="button" class="btn btn--ghost leave" onclick={() => vm.leave()}>Leave game</button>

  {#if vm.isHost}
    {#if !vm.canStart}
      <p class="hint hand">{`Need at least ${vm.minPlayers} players to start`}</p>
    {/if}
    <ActionBar>
      <button type="button" class="btn btn--primary btn--big" disabled={!vm.canStart} onclick={() => vm.start()}>
        {`Start Game (${vm.readyCount}/${vm.minPlayers})`}
      </button>
    </ActionBar>
  {/if}
</div>

<style>
  .waiting-room {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .col {
    display: contents;
  }

  .notice {
    margin: 0;
  }

  .caption {
    margin: 0;
    color: var(--ink-soft);
    font-family: var(--font-hand);
    font-size: calc(var(--fs-3) * var(--scale, 1));
    text-align: center;
  }

  .room-info {
    text-align: center;
  }

  .room-code-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0.25rem 0 0.75rem;
  }

  .room-code {
    font-family: var(--font-display);
    font-size: calc(var(--fs-7) * var(--scale, 1));
    letter-spacing: 0.2em;
    line-height: 1.1;
    text-indent: 0.2em;
  }

  .qr-box {
    width: min(220px, 60%);
    margin: 0 auto;
  }

  .share-instructions {
    margin: 0.9rem 0 0;
    color: var(--ink-soft);
    font-size: calc(var(--fs-2) * var(--scale, 1));
  }

  .share-instructions code {
    display: block;
    margin-top: 0.25rem;
    font-weight: 700;
    word-break: break-all;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .watching {
    margin: 0 0 0.5rem;
    color: var(--ink-soft);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .player-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .player-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 4px 0;
    border-bottom: 2px dashed var(--ink-soft);
  }

  .player-list li:last-child {
    border-bottom: none;
  }

  .player-list li.disconnected {
    opacity: 0.6;
  }

  .player-name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-display);
    font-size: calc(var(--fs-3) * var(--scale, 1));
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
  }

  .kick-btn {
    min-width: 44px;
    padding: 0;
  }

  .kick-confirm {
    font-family: var(--font-hand);
    font-size: var(--fs-3);
  }

  .leave {
    align-self: center;
  }

  .hint {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--fs-3);
    text-align: center;
  }

  :global(main.tv) .waiting-room {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    align-content: center;
    gap: 3rem;
  }

  :global(main.tv) .col {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  :global(main.tv) .qr-box {
    width: min(360px, 60%);
  }

  :global(main.tv) .player-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 2rem;
  }

  :global(main.tv) .player-list li {
    border-bottom: none;
  }

  :global(main.tv) .leave {
    grid-column: 1 / -1;
    justify-self: end;
    min-height: 36px;
    font-size: var(--fs-1);
  }
</style>
