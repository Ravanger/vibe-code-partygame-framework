import "./app.css";
import { GameConnectionManager } from "@partygame/game-client";
import { mount } from "svelte";
import { META } from "../src/meta.js";
import { BluffState } from "../src/state.js";
import App from "./App.svelte";
import { resolveEndpoints } from "./config.js";

const { endpoint, apiPort, apiBase } = resolveEndpoints();
const manager = new GameConnectionManager<BluffState>({
  endpoint,
  roomName: META.roomName,
  apiPort,
  ...(apiBase === undefined ? {} : { apiBase }),
  storagePrefix: "bluff",
  rootSchema: BluffState,
});

mount(App, { target: document.getElementById("app") ?? document.body, props: { manager } });
void manager.resume();
