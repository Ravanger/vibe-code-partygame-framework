import "./app.css";
import { GameConnectionManager } from "@partygame/game-client";
import { mount } from "svelte";
import { META } from "../src/meta.js";
import { __PascalName__State } from "../src/state.js";
import App from "./App.svelte";
import { resolveEndpoints } from "./config.js";

const { endpoint, apiPort, apiBase } = resolveEndpoints();
const manager = new GameConnectionManager<__PascalName__State>({
  endpoint,
  roomName: META.roomName,
  apiPort,
  ...(apiBase === undefined ? {} : { apiBase }),
  storagePrefix: "__slug__",
  rootSchema: __PascalName__State,
});

mount(App, { target: document.getElementById("app") ?? document.body, props: { manager } });
void manager.resume();
