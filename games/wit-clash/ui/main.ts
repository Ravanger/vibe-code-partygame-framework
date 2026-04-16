import { mount } from 'svelte';
import App from './App.svelte';
import { GameConnectionManager } from "../../packages/client/src/connection.js";

const manager = new GameConnectionManager("ws://localhost:2567");
const app = mount(App, {
  target: document.getElementById('app')!,
  props: { manager }
});

export default app;
