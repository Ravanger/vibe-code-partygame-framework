import "./app.css";
import { GameConnectionManager } from "@partygame/game-client/connection";
import { mount } from "svelte";
import App from "./App.svelte";
import { resolveEndpoints } from "./config.js";

const { endpoint, apiPort } = resolveEndpoints();
const manager = new GameConnectionManager(endpoint, apiPort);
const target = document.getElementById("app") ?? document.body;

await manager.tryReconnect();
const app = mount(App, {
  target,
  props: { manager },
});

export default app;
