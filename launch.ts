#!/usr/bin/env bun
/**
 * WitClash launcher: game server, API and client in one command.
 *
 *   bun run launch [--no-browser]         dev: game server + Vite (hot reload), http://localhost:5173
 *   bun run launch:dev [--no-browser]     same as above
 *   bun run launch:host [--no-browser]    dev, plus the LAN addresses guests join on
 *   bun run launch:prod [--no-browser]    build the client, serve it on http://localhost:3000
 *   bun run launch:bots [--no-browser]    dev, plus a room opened for you: the browser lands in it and
 *                                         3 bots join once you enter your name (any mode: --bots[=1..7])
 *   bun run launch:demo [--no-browser]    dev, plus a watch-only room that bots play by themselves; the browser
 *                                         opens its TV view (any mode: --demo[=2..7] bots, default 3)
 *
 * Ctrl+C stops everything. If any child dies, the rest is stopped and the launcher exits with 1.
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BotTable } from "./games/wit-clash/bots/botTable.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "./games/wit-clash/src/playerLimits.js";
import {
  DEMO_BOT_OPTIONS,
  DEMO_NEXT_ROUND_MS,
  DemoTable,
} from "./games/wit-clash/terminal/DemoTable.js";
import { joinUrl, tvUrl } from "./packages/shared/src/links.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const GAME_DIR = join(ROOT, "games", "wit-clash");

const GAME_SERVER_PORT = 2567;
const API_SERVER_PORT = 3001;
const CLIENT_DEV_PORT = 5173;
const PRODUCTION_PORT = 3000;
const READY_TIMEOUT_MS = 30_000;
const POLL_MS = 200;

const MODES = ["dev", "host", "prod"] as const;
type Mode = (typeof MODES)[number];
const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const children = new Set<ChildProcess>();
let httpServer: Server | undefined;
let stopping = false;
let botTable: { leave(): Promise<void> } | undefined;

const log = (message: string): void => console.log(`[Launch] ${message}`);
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function shutdown(code: number): never {
  stopping = true;
  for (const child of children) killTree(child);
  httpServer?.close();
  process.exit(code);
}

let stopRequested = false;
function stop(code: number): void {
  if (stopRequested) return;
  stopRequested = true;
  const leaving = botTable?.leave().catch(() => undefined);
  Promise.race([leaving, sleep(1000)]).finally(() => shutdown(code));
}

function fail(message: string): never {
  console.error(`[Launch] ${message}`);
  return shutdown(1);
}

function spawnChild(
  command: string[],
  cwd: string,
  env: Record<string, string> = {},
): ChildProcess {
  const [file, ...args] = command;
  const child = spawn(file ?? "", args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
    detached: process.platform !== "win32",
  });
  children.add(child);
  return child;
}

function startService(
  label: string,
  command: string[],
  cwd: string,
  env?: Record<string, string>,
): void {
  log(`Starting ${label}...`);
  const child = spawnChild(command, cwd, env);
  child.on("error", (error) => fail(`${label} failed to start: ${error.message}`));
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) fail(`${label} exited unexpectedly (${signal ?? `code ${code}`})`);
  });
}

function runToCompletion(label: string, command: string[], cwd: string): Promise<void> {
  log(`${label}...`);
  return new Promise((done, reject) => {
    const child = spawnChild(command, cwd);
    child.on("error", reject);
    child.on("exit", (code) => {
      children.delete(child);
      if (code === 0) done();
      else reject(new Error(`${label} failed (exit code ${code})`));
    });
  });
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ port, host: "localhost" });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReady(label: string, isReady: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!(await isReady())) {
    if (Date.now() > deadline) {
      fail(`${label} did not answer within ${READY_TIMEOUT_MS / 1000}s`);
    }
    await sleep(POLL_MS);
  }
  log(`${label} is ready`);
}

async function assertPortsFree(ports: Record<string, number>): Promise<void> {
  for (const [label, port] of Object.entries(ports)) {
    if (await canConnect(port)) fail(`Port ${port} (${label}) is already in use`);
  }
}

async function startGameServer(): Promise<void> {
  startService("game server", [process.execPath, "server.ts"], GAME_DIR, {
    PORT: String(GAME_SERVER_PORT),
    API_PORT: String(API_SERVER_PORT),
  });
  await waitUntilReady("Game server", () => canConnect(GAME_SERVER_PORT));
  await waitUntilReady("API", () =>
    answers(`http://localhost:${API_SERVER_PORT}/api/resolve-code?code=ZZZZ`),
  );
}

async function startClientDev(): Promise<void> {
  startService("Vite dev server", [process.execPath, "run", "dev", "--strictPort"], GAME_DIR);
  await waitUntilReady("Vite", () => answers(`http://localhost:${CLIENT_DEV_PORT}/`));
}

async function serveProduction(): Promise<void> {
  const dist = resolve(GAME_DIR, "dist");
  httpServer = createServer(async (req, res) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("Bad Request");
      return;
    }
    const file = resolve(dist, `.${pathname === "/" ? "/index.html" : pathname}`);
    const info = file.startsWith(dist + sep) ? await stat(file).catch(() => undefined) : undefined;
    if (!info?.isFile()) {
      res.writeHead(404).end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((done, reject) => {
    httpServer?.once("error", reject);
    httpServer?.listen(PRODUCTION_PORT, done);
  });
  log(`Serving ${dist} on port ${PRODUCTION_PORT}`);
}

function lanUrls(port: number): string[] {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => `http://${address.address}:${port}`);
}

function openBrowser(url: string): void {
  const opener =
    process.platform === "win32"
      ? { file: "cmd", args: ["/c", "start", "", url] }
      : { file: process.platform === "darwin" ? "open" : "xdg-open", args: [url] };
  log(`Opening ${url}`);
  const child = spawn(opener.file, opener.args, { stdio: "ignore", detached: true });
  child.on("error", () => log(`Could not open a browser. Open ${url} yourself.`));
  child.unref();
}

async function startBots(
  count: number,
  clientUrl: string,
  shouldOpenBrowser: boolean,
): Promise<void> {
  const table = new BotTable({
    endpoint: `ws://localhost:${GAME_SERVER_PORT}`,
    apiPort: API_SERVER_PORT,
    bot: { log: (line) => console.log(`[Bots] ${line}`) },
  });
  botTable = table;
  const code = await table.open();
  const url = joinUrl(`${clientUrl}/`, code);
  log(`Room ${code}: bots join once you have entered your name`);
  if (shouldOpenBrowser) openBrowser(url);
  else log(`Open ${url}`);
  const bots = await table.seatBots({ count });
  for (const bot of bots) log(`${bot.name} joined ${code}`);
}

async function startDemo(
  count: number,
  clientUrl: string,
  shouldOpenBrowser: boolean,
): Promise<void> {
  const table = new DemoTable({
    endpoint: `ws://localhost:${GAME_SERVER_PORT}`,
    apiPort: API_SERVER_PORT,
    bots: count,
    bot: { ...DEMO_BOT_OPTIONS, log: (line) => console.log(`[Bots] ${line}`) },
    nextRoundDelayMs: DEMO_NEXT_ROUND_MS,
  });
  botTable = table;
  const code = await table.open();
  const url = tvUrl(`${clientUrl}/`, code);
  log(`Demo room ${code}: watch-only, ${count + 1} bots play one game`);
  if (shouldOpenBrowser) openBrowser(url);
  else log(`Open ${url}`);
  await table.seatBots();
  await table.finished();
  log("Demo finished; Ctrl+C to exit");
}

async function launch(
  mode: Mode,
  shouldOpenBrowser: boolean,
  botCount: number | undefined,
  demoCount: number | undefined,
): Promise<void> {
  const clientPort = mode === "prod" ? PRODUCTION_PORT : CLIENT_DEV_PORT;
  await assertPortsFree({
    "game server": GAME_SERVER_PORT,
    API: API_SERVER_PORT,
    client: clientPort,
  });
  if (mode === "prod") {
    await runToCompletion("Building client", [process.execPath, "run", "build"], GAME_DIR);
  }
  await startGameServer();
  if (mode === "prod") await serveProduction();
  else await startClientDev();

  const url = `http://localhost:${clientPort}`;
  log(`Ready (${mode}): ${url}`);
  if (mode !== "dev") {
    for (const lan of lanUrls(clientPort)) log(`Guests on this network: ${lan}`);
  }
  log("Press Ctrl+C to stop");
  if (demoCount !== undefined) {
    startDemo(demoCount, url, shouldOpenBrowser).catch((error: unknown) =>
      log(`Demo stopped: ${error instanceof Error ? error.message : String(error)}`),
    );
    return;
  }
  if (botCount === undefined) {
    if (shouldOpenBrowser) openBrowser(url);
    return;
  }
  startBots(botCount, url, shouldOpenBrowser).catch((error: unknown) =>
    log(`Bots stopped: ${error instanceof Error ? error.message : String(error)}`),
  );
}

const USAGE = `Usage: bun run launch.ts [dev|host|prod] [--no-browser] [--bots[=1..${MAX_PLAYERS - 1}] | --demo[=${MIN_PLAYERS - 1}..${MAX_PLAYERS - 1}]]`;
const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("--"));
const positional = args.filter((arg) => !arg.startsWith("--"));
const modeArg = positional[0] ?? "dev";
const botsFlag = flags.find((flag) => flag === "--bots" || flag.startsWith("--bots="));
const botCount = botsFlag === undefined ? undefined : Number(botsFlag.split("=")[1] ?? "3");
const demoFlag = flags.find((flag) => flag === "--demo" || flag.startsWith("--demo="));
const demoCount = demoFlag === undefined ? undefined : Number(demoFlag.split("=")[1] ?? "3");
const unknownFlags = flags.filter(
  (flag) => flag !== "--no-browser" && flag !== botsFlag && flag !== demoFlag,
);
const badBots =
  botCount !== undefined &&
  !(Number.isInteger(botCount) && botCount >= 1 && botCount <= MAX_PLAYERS - 1);
const badDemo =
  demoCount !== undefined &&
  !(Number.isInteger(demoCount) && demoCount >= MIN_PLAYERS - 1 && demoCount <= MAX_PLAYERS - 1);

if (!isMode(modeArg) || positional.length > 1 || unknownFlags.length > 0 || badBots || badDemo) {
  console.error(USAGE);
  process.exit(2);
}
if (botsFlag !== undefined && demoFlag !== undefined) {
  console.error("--demo and --bots cannot be combined: --demo opens its own watch-only room.");
  process.exit(2);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
launch(modeArg, !flags.includes("--no-browser"), botCount, demoCount).catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
