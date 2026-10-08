<script lang="ts">
import { WaitingRoomViewModel } from "@partygame/game-ui";
import { NameInput, PlayerSticker, StatusPanel } from "@partygame/game-ui/components";
import { untrack } from "svelte";
import type { __PascalName__Manager } from "../manager.js";

const { manager }: { manager: __PascalName__Manager } = $props();

const vm = untrack(() => new WaitingRoomViewModel(manager));

$effect(() => () => vm.destroy());
</script>

<div class="lobby stack">
  {#if vm.notice}
    <p class="notice" role="status">{vm.notice}</p>
  {/if}

  {#if !vm.isSpectator}
    <NameInput field={vm.nameField} focus={vm.needsName} />
  {/if}

  {#if vm.showJoinInfo}
    <div class="room-info card">
      <p class="caption">Room code</p>
      <span class="room-code">{vm.roomCode}</span>
      <p class="share"><code>{vm.shareUrl}</code></p>
    </div>
  {/if}

  {#if vm.showWaitingPanel}
    <StatusPanel tone="wait" title="Waiting for the host to start..." />
  {/if}

  <ul class="players">
    {#each vm.players as player (player.id)}
      <li class="player" class:me={player.isMe}>
        <PlayerSticker name={player.name} playerId={player.id} ghost={!player.isReady} size={40} />
        <span class="name">{player.isReady ? player.name : "Choosing a name..."}</span>
        {#if player.isMe}<span class="chip">(You)</span>{/if}
        {#if player.isHost}<span class="chip">Host</span>{/if}
        {#if !player.isConnected}<span class="chip chip--paper">(Disconnected)</span>{/if}
      </li>
    {/each}
  </ul>

  <button type="button" class="btn btn--ghost leave" onclick={() => vm.leave()}>Leave game</button>

  {#if vm.isHost}
    <div class="action-bar">
      <button type="button" class="btn btn--primary" disabled={!vm.canStart} onclick={() => vm.start()}>
        {`Start (${vm.readyCount}/${vm.minPlayers})`}
      </button>
    </div>
  {/if}
</div>

<style>
  .lobby {
    padding-top: 8px;
  }

  .notice {
    margin: 0;
    padding: 0.75rem 1rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--sun);
    color: var(--ink);
    font-weight: 600;
    text-align: center;
  }

  .room-info {
    text-align: center;
  }

  .caption {
    margin: 0;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: var(--fs-1);
  }

  .room-code {
    display: block;
    font-family: var(--font-display);
    font-size: var(--fs-5);
    letter-spacing: 10px;
  }

  .share {
    margin: 0.5rem 0 0;
    overflow-wrap: anywhere;
    color: var(--ink-soft);
    font-size: var(--fs-1);
  }

  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.9rem;
    border: var(--outline);
    border-radius: var(--radius-card);
    background: var(--white);
  }

  .player.me {
    background: var(--fill, #fff8ea);
  }

  .name {
    flex: 1;
    font-weight: 600;
  }

  .leave {
    align-self: center;
  }
</style>
