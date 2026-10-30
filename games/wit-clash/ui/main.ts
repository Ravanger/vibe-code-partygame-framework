import "@fontsource/lilita-one";
import "@fontsource/gochi-hand";
import "./app.css";
import { GameConnectionManager } from "@partygame/game-client";
import { mount } from "svelte";
import { META } from "../src/meta.js";
import { WitClashState } from "../src/state.js";
import App from "./App.svelte";
import { resolveEndpoints } from "./config.js";
import ReplayApp from "./ReplayApp.svelte";

const target = document.getElementById("app") ?? document.body;

// `?replay` mounts the offline viewer: no manager, so no server connection is ever opened.
if (new URLSearchParams(window.location.search).has("replay")) {
  mount(ReplayApp, { target });
} else {
  const { endpoint, apiPort, apiBase } = resolveEndpoints();
  const manager = new GameConnectionManager<WitClashState>({
    endpoint,
    roomName: META.roomName,
    apiPort,
    ...(apiBase === undefined ? {} : { apiBase }),
    storagePrefix: "witclash",
    rootSchema: WitClashState,
  });

  mount(App, { target, props: { manager } });
  void manager.resume();
}
