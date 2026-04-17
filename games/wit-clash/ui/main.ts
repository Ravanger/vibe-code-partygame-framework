import { mount } from "svelte";
import { GameConnectionManager } from "../../../packages/client/src/connection.svelte.js";
import App from "./App.svelte";

const manager = new GameConnectionManager("http://localhost:2567");
const target = document.getElementById("app") ?? document.body;

const app = mount(App, {
  target,
  props: { manager },
});

export default app;
