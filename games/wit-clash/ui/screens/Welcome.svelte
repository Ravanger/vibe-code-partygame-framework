<script lang="ts">
import type { GameConnectionManager } from "@partygame/game-client/connection";
import { WelcomeViewModel } from "../viewmodels/WelcomeViewModel.svelte.js";

const { manager }: { manager: GameConnectionManager } = $props();

// Read URL code in a jsdom-safe way
let urlCode: string | undefined;
try {
  urlCode = new URLSearchParams(window.location.search).get("code") ?? undefined;
} catch {
  // window is unavailable in some contexts
}

// svelte-ignore state_referenced_locally -- manager is a stable long-lived instance, never reassigned by the parent
const vm = new WelcomeViewModel(manager, urlCode);

$effect(() => {
  void vm.autoJoinIfRequested();
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const roomCode = $derived((manager.room?.state as { roomCode?: string } | undefined)?.roomCode);
</script>

<div class="welcome">
  <h1>WitClash</h1>

  {#if vm.localError ?? manager.error}
    <p class="error">
      {vm.localError ?? manager.error}
      <button class="dismiss" onclick={() => vm.dismissError()} aria-label="Dismiss">×</button>
    </p>
  {/if}

  {#if roomCode}
    <p class="room-code">Room code: {roomCode}</p>
  {/if}

  <button class="host-btn" disabled={vm.busy} onclick={() => vm.host()}>
    Host Game
  </button>

  <div class="join-section">
    <input
      type="text"
      placeholder="Enter code"
      maxlength="4"
      value={vm.code}
      oninput={(e) => vm.setCode((e.target as HTMLInputElement).value)}
    />
    <button disabled={vm.busy || !vm.codeIsValid} onclick={() => vm.join()}> Join </button>
  </div>

  {#if vm.previousRoomCode}
    <button class="rejoin-btn" onclick={() => vm.rejoinPrevious()} disabled={vm.busy}>
      Rejoin {vm.previousRoomCode}
    </button>
  {/if}
</div>

<style>
  .welcome {
    max-width: 500px;
    margin: 0 auto;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
  }

  .error {
    color: #b91c1c;
    background: #fee2e2;
    padding: 10px 16px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .dismiss {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.3rem;
    cursor: pointer;
    padding: 0 4px;
    flex-shrink: 0;
  }

  .room-code {
    color: #666;
  }

  .host-btn {
    padding: 14px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
  }

  .host-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .join-section {
    display: flex;
    gap: 8px;
  }

  .join-section input {
    padding: 10px 14px;
    font-size: 1rem;
    border: 2px solid #eee;
    border-radius: 8px;
    text-transform: uppercase;
  }

  .join-section button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: #f0f0f0;
    cursor: pointer;
  }

  .join-section button:disabled {
    color: #aaa;
    cursor: not-allowed;
  }

  .rejoin-btn {
    padding: 10px 20px;
    border: 2px solid #ddd;
    border-radius: 8px;
    background: #fff;
    color: #555;
    cursor: pointer;
    font-size: 0.95rem;
  }

  .rejoin-btn:disabled {
    color: #aaa;
    border-color: #eee;
    cursor: not-allowed;
  }
</style>
