import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import {
  ActionBar,
  GameControls,
  LobbySettings,
  NameInput,
  PlayerSticker,
  Podium,
  QrCode,
  StatusPanel,
  Timer,
} from "../src/components/index.js";
import { GameControlsViewModel } from "../src/GameControlsViewModel.svelte.js";
import { type PodiumRow, podiumSteps, rankRows } from "../src/index.js";
import { LobbySettingsViewModel } from "../src/LobbySettingsViewModel.svelte.js";
import { NameField } from "../src/NameField.svelte.js";
import { TEST_DEFAULTS, TestOptionsSchema } from "./fixtures/optionsSchema.js";

/** The CSS Svelte dev injects when the component type mounts for the first time in this file. */
function cssOf(mount: () => { unmount(): void }): string {
  const before = new Set([...document.querySelectorAll("style")].map((s) => s.textContent));
  const app = mount();
  const added = [...document.querySelectorAll("style")]
    .map((s) => s.textContent)
    .filter((text): text is string => text !== undefined && !before.has(text));
  app.unmount();
  return added.join("\n");
}

/**
 * Walks a CSS text and reports every `transition*` / `animation*` declaration that is not inside
 * an `@media (prefers-reduced-motion: no-preference)` block — motion must be opt-in, so users
 * with reduced-motion preferences never see it (#82).
 */
function unguardedMotion(css: string): string[] {
  const findings: string[] = [];
  const stack: string[] = [];
  let buffer = "";
  let inComment = false;

  const guarded = (): boolean =>
    stack.some(
      (prelude) =>
        prelude.startsWith("@media") && prelude.includes("prefers-reduced-motion: no-preference"),
    );

  const checkDeclaration = (declaration: string): void => {
    const colon = declaration.indexOf(":");
    if (colon < 0) return;
    const property = declaration.slice(0, colon).trim();
    if (!/^(transition[\w-]*|animation[\w-]*)$/.test(property)) return;
    if (!guarded()) findings.push(`${property} outside a reduced-motion guard`);
  };

  let i = 0;
  while (i < css.length) {
    const ch = css.charAt(i);
    if (inComment) {
      if (ch === "*" && css.charAt(i + 1) === "/") {
        inComment = false;
        i += 2;
      } else {
        ++i;
      }
      continue;
    }
    if (ch === "/" && css.charAt(i + 1) === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === "{") {
      stack.push(buffer.trim());
      buffer = "";
      ++i;
      continue;
    }
    if (ch === "}") {
      const top = stack[stack.length - 1];
      if (top !== undefined && !top.startsWith("@") && buffer.trim() !== "")
        checkDeclaration(buffer);
      stack.pop();
      buffer = "";
      ++i;
      continue;
    }
    if (ch === ";") {
      const top = stack[stack.length - 1];
      if (top !== undefined && !top.startsWith("@")) checkDeclaration(buffer);
      buffer = "";
      ++i;
      continue;
    }
    buffer += ch;
    ++i;
  }

  return findings;
}

describe("reduced motion", () => {
  it("keeps every transition and animation behind prefers-reduced-motion: no-preference", () => {
    const rows: Omit<PodiumRow, "rank">[] = [
      { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: true },
      { playerId: "b", name: "Bo", score: 20, hasLeft: false, isMe: false },
      { playerId: "c", name: "Cy", score: 10, hasLeft: false, isMe: false },
    ];
    const mounts: Array<[string, () => { unmount(): void }]> = [
      [
        "ActionBar",
        () =>
          render(ActionBar, {
            children: createRawSnippet(() => ({ render: () => "<span></span>" })),
          }),
      ],
      [
        "GameControls",
        () =>
          render(GameControls, {
            vm: new GameControlsViewModel(
              connectedClient({ stateClass: BaseGameState, phase: "Play" }).manager,
            ),
          }),
      ],
      [
        "LobbySettings",
        () => {
          const c = connectedClient({ stateClass: BaseGameState, seat: { role: "host" } });
          c.state.options = JSON.stringify({ turnSeconds: 30 });
          return render(LobbySettings, {
            vm: new LobbySettingsViewModel(c.manager, {
              schema: TestOptionsSchema,
              defaults: TEST_DEFAULTS,
            }),
          });
        },
      ],
      [
        "NameInput",
        () =>
          render(NameInput, {
            field: new NameField(connectedClient({ stateClass: BaseGameState }).manager),
          }),
      ],
      ["PlayerSticker", () => render(PlayerSticker, { name: "maya", playerId: "p-1" })],
      ["Podium", () => render(Podium, { steps: podiumSteps(rankRows(rows)) })],
      ["QrCode", () => render(QrCode, { text: "http://localhost/?code=ABCD" })],
      ["StatusPanel", () => render(StatusPanel, { title: "Hold on", tone: "wait" })],
      ["Timer", () => render(Timer, { seconds: 10, total: 30 })],
    ];
    const css: Record<string, string> = {};
    for (const [name, mount] of mounts) css[name] = cssOf(mount);
    const findings = Object.entries(css).flatMap(([name, text]) =>
      unguardedMotion(text).map((finding) => `${name}: ${finding}`),
    );
    expect(findings).toEqual([]);
    // the harness must have actually captured the styles of the components that animate
    for (const name of ["Timer", "StatusPanel", "LobbySettings", "Podium"]) {
      expect(css[name] ?? "").toMatch(/animation|transition/);
    }
  });

  it("flags unguarded motion in synthetic css, and accepts guarded motion", () => {
    expect(unguardedMotion(".a { transition: opacity 1s ease; }")).toEqual([
      "transition outside a reduced-motion guard",
    ]);
    expect(
      unguardedMotion(".a { animation: spin 2s linear infinite; } .b { animation-delay: 1s; }"),
    ).toHaveLength(2);
    expect(
      unguardedMotion(
        "@media (prefers-reduced-motion: no-preference) { .a { animation: spin 2s linear infinite; } }",
      ),
    ).toEqual([]);
    expect(
      unguardedMotion("@media (prefers-reduced-motion: reduce) { .a { transition: opacity 1s; } }"),
    ).toHaveLength(1);
    expect(unguardedMotion(".a { transition-duration: 1s; transition-delay: 2s; }")).toEqual([
      "transition-duration outside a reduced-motion guard",
      "transition-delay outside a reduced-motion guard",
    ]);
  });
});
