import { mount } from "svelte";
import { GameConnectionManager } from "../../../packages/game-client/src/connection.svelte.js";
import App from "./App.svelte";

// API server runs on port 3001
const manager = new GameConnectionManager("http://localhost:2567", 3001);
const target = document.getElementById("app") ?? document.body;

const app = mount(App, {
  target,
  props: { manager },
});

export default app;
