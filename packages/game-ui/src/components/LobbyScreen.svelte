<script lang="ts" generics="TState extends BaseGameState">
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute
import type { BaseGameState } from "@partygame/shared/schema";
import type { Snippet } from "svelte";
import type { LobbySettingsViewModel } from "../LobbySettingsViewModel.svelte.js";
import { getStrings } from "../strings.js";
import type { WaitingRoomViewModel } from "../WaitingRoomViewModel.svelte.js";
import ActionBar from "./ActionBar.svelte";
import LobbySettings from "./LobbySettings.svelte";
import NameInput from "./NameInput.svelte";
import PlayerSticker from "./PlayerSticker.svelte";
import QrCode from "./QrCode.svelte";
import StatusPanel from "./StatusPanel.svelte";

const {
  vm,
  settings,
  extra,
}: {
  vm: WaitingRoomViewModel<TState>;
  settings?: LobbySettingsViewModel<TState>;
  extra?: Snippet;
} = $props();

const strings = getStrings();
</script>

<div class="lobby-screen">
  <div class="col">
    {#if vm.notice}
      <p class="notice" role="status">{vm.notice}</p>
    {/if}

    {#if vm.nameFirst && !vm.isSpectator}
      <NameInput field={vm.nameField} focus />
    {/if}

    {#if vm.showJoinInfo}
      <div class="room-info card taped">
        <p class="caption">{strings.roomCodeLabel}</p>
        <div class="room-code-display">
          <span class="room-code">{vm.roomCode}</span>
          {#if !vm.isSpectator}
            <button type="button" class="btn btn--secondary" onclick={() => vm.copyCode()}>
              {strings.copyCode}
            </button>
          {/if}
        </div>
        <!-- Always present so a screen reader announces the status change, not just new markup. -->
        <p class="copy-status" aria-live="polite">{vm.copyStatusText}</p>
        <div class="qr-box">
          <QrCode text={vm.shareUrl} />
        </div>
        <p class="share-instructions">
          {`${strings.shareInstructions} `}<code>{vm.shareUrl}</code>
        </p>
      </div>
    {/if}

    {#if vm.showWaitingPanel}
      <StatusPanel tone="wait" title={strings.waitingForHost} />
    {/if}
  </div>

  <div class="col">
    <div class="card">
      <h2 tabindex="-1">{strings.playersHeading(vm.readyCount, vm.minPlayers, vm.maxPlayers)}</h2>
      {#if vm.spectatorCount > 0}
        <p class="watching hand">{strings.watchingOnTv(vm.spectatorCount)}</p>
      {/if}
      <ul class="player-list">
        {#each vm.players as player (player.id)}
          <li class:disconnected={!player.isConnected}>
            <PlayerSticker name={player.name} playerId={player.id} ghost={!player.isReady} size={48} />
            <span class="player-name">{player.isReady ? player.name : strings.choosingName}</span>
            <div class="badges">
              {#if player.isMe}
                <span class="chip chip--sky">{strings.youBadge}</span>
              {/if}
              {#if player.isHost}
                <span class="chip"
                  ><span aria-hidden="true">&#128081;</span>{` ${strings.hostBadge}`}</span
                >
              {/if}
              {#if !player.isConnected}
                <span class="chip chip--paper">{strings.disconnectedBadge}</span>
              {/if}
              {#if vm.canKick(player)}
                {#if vm.kickCandidate === player.id}
                  <span class="kick-confirm">{strings.kickConfirm}</span>
                  <button type="button" class="btn btn--danger" onclick={() => vm.confirmKick()}>
                    {strings.yes}
                  </button>
                  <button type="button" class="btn" onclick={() => vm.cancelKick()}>{strings.no}</button>
                {:else}
                  <button
                    type="button"
                    class="btn kick-btn"
                    aria-label={strings.removePlayer(player.name || "player")}
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

    {#if settings}
      <LobbySettings vm={settings} />
    {/if}

    {#if extra}
      {@render extra()}
    {/if}
  </div>

  <button type="button" class="btn btn--ghost leave" onclick={() => vm.leave()}>
    {strings.leaveGame}
  </button>

  {#if vm.isHost}
    {#if !vm.canStart}
      <p class="hint hand">{strings.needAtLeast(vm.minPlayers)}</p>
    {/if}
    <ActionBar>
      <button
        type="button"
        class="btn btn--primary btn--big"
        disabled={!vm.canStart}
        onclick={() => vm.start()}
      >
        {strings.startGame(vm.readyCount, vm.minPlayers)}
      </button>
    </ActionBar>
  {/if}
</div>

<style>
  .lobby-screen {
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
    font-size: calc(var(--fs-5) * var(--scale, 1));
    letter-spacing: 0.2em;
    line-height: 1.1;
    text-indent: 0.2em;
  }

  .copy-status {
    margin: 0.25rem 0 0;
    min-height: calc(var(--fs-2) * var(--scale, 1) * 1.4);
    color: var(--ink-soft);
    font-size: calc(var(--fs-2) * var(--scale, 1));
    text-align: center;
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

  :global(main.tv) .lobby-screen {
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
    font-size: calc(var(--fs-1) * var(--scale, 1));
  }
</style>
