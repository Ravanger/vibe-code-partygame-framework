import ShellLobbyFixture from "./ShellLobbyFixture.svelte";
import ShellNameFixture from "./ShellNameFixture.svelte";
import ShellPlainFixture from "./ShellPlainFixture.svelte";
import ShellPlayFixture from "./ShellPlayFixture.svelte";

/** The phase screens the GameShell tests route through. */
export const SHELL_SCREENS = {
  Lobby: { component: ShellLobbyFixture, waitingLabel: "Waiting in the lobby", banner: "" },
  Name: { component: ShellNameFixture, waitingLabel: "Picking a name", banner: "" },
  Plain: { component: ShellPlainFixture, waitingLabel: "No heading here", banner: "" },
  Play: { component: ShellPlayFixture, waitingLabel: "Playing", banner: "GO!" },
};
