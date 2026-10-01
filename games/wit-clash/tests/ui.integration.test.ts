import { GameConnectionManager } from "@partygame/game-client";
import { bootTestServer, type TestServer, waitUntil } from "@partygame/server/testing";
import { ErrorCode, KICK_PLAYER } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createWitClashGame } from "../src/game.js";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";
import { AppViewModel } from "../ui/viewmodels/AppViewModel.js";
import { CategoryVoteViewModel } from "../ui/viewmodels/CategoryVoteViewModel.js";
import { JoinNextRoundViewModel } from "../ui/viewmodels/JoinNextRoundViewModel.js";
import { LobbySettingsViewModel } from "../ui/viewmodels/LobbySettingsViewModel.svelte.js";
import { MatchupRevealViewModel } from "../ui/viewmodels/MatchupRevealViewModel.js";
import { MatchupVoteViewModel } from "../ui/viewmodels/MatchupVoteViewModel.js";
import { PromptingViewModel } from "../ui/viewmodels/PromptingViewModel.svelte.js";
import { ResultsViewModel } from "../ui/viewmodels/ResultsViewModel.js";
import { makeCategories } from "./game/support.js";

type Manager = GameConnectionManager<WitClashState>;

let t: TestServer;
let apiPort: number;
let clients = 0;
const managers: Manager[] = [];

beforeAll(async () => {
  t = await bootTestServer({
    games: [
      {
        roomName: ROOM_NAME,
        definition: createWitClashGame({ categories: makeCategories() }),
        stateClass: WitClashState,
      },
    ],
  });
  apiPort = await t.serveApi();
});
afterEach(async () => {
  for (const manager of managers.splice(0)) manager.dispose();
  await t.cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => t.shutdown());

function newManager(): Manager {
  const manager = new GameConnectionManager<WitClashState>({
    endpoint: t.endpoint,
    roomName: ROOM_NAME,
    apiPort,
    storagePrefix: `witclash-it-${++clients}`,
    rootSchema: WitClashState,
  });
  managers.push(manager);
  return manager;
}

async function seatThree() {
  const host = newManager();
  await host.create({ totalRounds: 1, revealSeconds: 1 });
  const guests = [newManager(), newManager()];
  for (const guest of guests) await guest.join(host.roomCode as string);
  const all = [host, ...guests];
  for (const [index, manager] of all.entries()) manager.setName(`Player ${index + 1}`);
  await waitUntil(() => host.state?.canStart === true, "host can start");
  await host.sendAction("START_GAME");
  return all;
}

const screenName = (manager: Manager) => {
  const route = new AppViewModel(manager).screen;
  return route.kind === "phase" ? route.phase : route.kind;
};
const screens = (all: Manager[]) => all.map(screenName);
const everyoneOn = (all: Manager[], screen: string) => () =>
  screens(all).every((s) => s === screen);

describe("a round through the real client SDK and view models", () => {
  it("plays the lobby, one full round and back to the lobby", async () => {
    const all = await seatThree();
    const [host] = all as [Manager, ...Manager[]];
    await waitUntil(everyoneOn(all, "CategorySelection"), "category vote screens");

    expect(new LobbySettingsViewModel(host).valueOf("totalRounds")).toBe("1");

    for (const manager of all) {
      const view = new CategoryVoteViewModel(manager);
      expect(view.roundLabel).toBe("Round 1 of 1");
      expect(view.options).toHaveLength(3);
      await view.vote(view.options[0]?.id as string);
      view.destroy();
    }

    await waitUntil(everyoneOn(all, "Prompting"), "prompting screens");
    for (const manager of all) {
      await waitUntil(() => new PromptingViewModel(manager).prompts.length === 2, "prompts dealt");
      const view = new PromptingViewModel(manager);
      for (let i = 0; i < 2; ++i) {
        view.setDraft(`answer ${i} from ${manager.me()?.name}`);
        await view.submit();
      }
      await waitUntil(() => view.allSubmitted, "answers accepted");
      view.destroy();
    }

    let revealed = 0;
    while (!screens(all).every((s) => s === "Results")) {
      await waitUntil(
        () => screens(all).every((s) => s === "MatchupVoting" || s === "Results"),
        "voting or results",
      );
      if (screens(all).every((s) => s === "Results")) break;
      const views = all.map((manager) => new MatchupVoteViewModel(manager));
      const voters = views.filter((view) => view.canVote);
      expect(voters.length).toBeGreaterThan(0);
      expect(views.some((view) => view.isOwnMatchup)).toBe(true);
      for (const view of views) expect(view.choices).toHaveLength(2);
      expect(views.every((view) => view.votesCast === 0 && view.votesExpected === 1)).toBe(true);
      expect(
        host.state?.matchups[host.state.activeMatchupIndex]?.answers.every(
          (a) => a.votes === 0 && a.authorId === "",
        ),
      ).toBe(true);
      const voter = voters[0] as MatchupVoteViewModel;
      await voter.vote(voter.choices[0]?.id as string);
      await waitUntil(everyoneOn(all, "MatchupReveal"), "reveal screens");
      const reveal = new MatchupRevealViewModel(host);
      expect(reveal.matchup?.answers.every((a) => a.authorName.startsWith("Player"))).toBe(true);
      expect(voter.choices[0]?.isMine).toBe(true);
      ++revealed;
      for (const view of views) view.destroy();
      reveal.destroy();
      await waitUntil(
        () => screens(all).every((s) => s === "MatchupVoting" || s === "Results"),
        "next matchup",
      );
    }
    expect(revealed).toBeGreaterThan(0);

    const results = all.map((manager) => new ResultsViewModel(manager));
    for (const view of results) {
      expect(view.isFinalRound).toBe(true);
      expect(view.scoreboard.rows).toHaveLength(3);
      expect(view.champions.length).toBeGreaterThan(0);
      expect(view.matchups.length).toBeGreaterThan(0);
    }
    expect(results.map((view) => view.showPlayAgain)).toEqual([true, false, false]);

    await results[0]?.playAgain();
    await waitUntil(everyoneOn(all, "Lobby"), "back in the lobby");
    expect(all.every((manager) => manager.lastServerError === undefined)).toBe(true);
  }, 30_000);

  it("puts a mid-game joiner on the waiting screen, and a kicked player back on the welcome screen", async () => {
    const all = await seatThree();
    const [host] = all as [Manager, ...Manager[]];
    await waitUntil(everyoneOn(all, "CategorySelection"), "game started");

    const late = newManager();
    await late.join(host.roomCode as string);
    await waitUntil(() => screenName(late) === "join-next-round", "late joiner waits");
    const joining = new JoinNextRoundViewModel(late);
    expect(joining.needsName).toBe(true);
    joining.nameField.set("Latecomer");
    await waitUntil(() => late.me()?.name === "Latecomer", "late joiner named");
    joining.destroy();
    expect(joining.needsName).toBe(false);
    expect(screenName(late)).toBe("join-next-round");

    const rejected = await late.sendAction("VOTE_CATEGORY", { categoryId: "x" });
    expect(rejected).toMatchObject({ ok: false, error: { code: ErrorCode.NOT_ACTIVE } });

    await host.sendAction(KICK_PLAYER, { playerId: late.playerId });
    await waitUntil(() => screenName(late) === "welcome", "kicked player on welcome");
    expect(new AppViewModel(late).error?.code).toBe(ErrorCode.KICKED);
  });
});
