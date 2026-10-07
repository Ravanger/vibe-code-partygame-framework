import "./app.css";
import { GameConnectionManager } from "@partygame/game-client";
import { mount } from "svelte";
import { ROOM_NAME } from "../src/roomName.js";
import { __PascalName__State } from "../src/state.js";
import App from "./App.svelte";
import { resolveEndpoints } from "./config.js";

const { endpoint, apiPort } = resolveEndpoints();
const manager = new GameConnectionManager<__PascalName__State>({
  endpoint,
  roomName: ROOM_NAME,
  apiPort,
  storagePrefix: "__slug__",
  rootSchema: __PascalName__State,
});

mount(App, { target: document.getElementById("app") ?? document.body, props: { manager } });
void manager.resume();
