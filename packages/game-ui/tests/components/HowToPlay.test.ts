import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import type {
  HowToPlayStep,
  HowToPlayViewModelOptions,
} from "../../src/HowToPlayViewModel.svelte.js";
import { HowToPlayViewModel } from "../../src/HowToPlayViewModel.svelte.js";
import HowToPlayFixture from "../fixtures/HowToPlayFixture.svelte";
import { expectNoViolations } from "../support/a11y.js";

/** A memory storage for the seen flag. */
function fakeStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
}

/** A timer that records the running intervals so a test can fire them. */
function fakeTimer() {
  const running = new Map<unknown, { callback: () => void; ms: number }>();
  let nextId = 0;
  return {
    running,
    setInterval(callback: () => void, ms: number): unknown {
      const id = ++nextId;
      running.set(id, { callback, ms });
      return id;
    },
    clearInterval(id: unknown): void {
      running.delete(id);
    },
  };
}

const fireAll = (timer: ReturnType<typeof fakeTimer>): void => {
  for (const interval of [...timer.running.values()]) interval.callback();
};

const STEPS: HowToPlayStep[] = [
  { title: "First step", body: "Do the first thing." },
  { title: "Second step", body: "Do the second thing." },
  { title: "Third step", body: "Do the third thing." },
];

function setup(seatless = false, extra: Partial<HowToPlayViewModelOptions> = {}) {
  const c = connectedClient({ stateClass: BaseGameState });
  if (seatless) c.state.players.delete(c.manager.playerId);
  const storage = fakeStorage();
  const vm = new HowToPlayViewModel(
    c.manager,
    { storage, storagePrefix: "test-game", ...extra },
    () => STEPS.length,
  );
  return { c, storage, vm };
}

const dialog = () => screen.queryByRole("dialog");
const background = () => document.getElementById("background-button") as HTMLElement;

describe("HowToPlay", () => {
  it("renders nothing without steps", () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: [] });
    expect(dialog()).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "How to play" })).not.toBeInTheDocument();
  });

  it("auto-opens once per browser and renders the steps in order with a dot row", () => {
    const { storage, vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    expect(storage.values.get("test-game.howToPlaySeen")).toBe("1");
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument();
    expect(screen.getByText("Do the first thing.")).toBeInTheDocument();

    const dots = screen.getAllByRole("button", { name: /^step \d of 3$/i });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("aria-current", "step");
    expect(dots[1]).not.toHaveAttribute("aria-current");
  });

  it("does not auto-open on a second visit, but the button reopens it", async () => {
    const { storage } = setup();
    const first = new HowToPlayViewModel(
      connectedClient({ stateClass: BaseGameState }).manager,
      { storage, storagePrefix: "test-game" },
      () => STEPS.length,
    );
    const mounted = render(HowToPlayFixture, { vm: first, steps: STEPS });
    expect(dialog()).toBeInTheDocument();
    mounted.unmount();

    const second = new HowToPlayViewModel(
      connectedClient({ stateClass: BaseGameState }).manager,
      { storage, storagePrefix: "test-game" },
      () => STEPS.length,
    );
    render(HowToPlayFixture, { vm: second, steps: STEPS, withButton: true });
    expect(dialog()).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(dialog()).toBeInTheDocument();
  });

  it("walks the steps with next and back, wrapping at both ends", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument(),
    );

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Second step" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    vm.goTo(2);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Third step" })).toBeInTheDocument(),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument(),
    );
  });

  it("renders a step's illustration and example snippets, and the step reads without them", async () => {
    const steps: HowToPlayStep[] = [
      { title: "Plain", body: "Reads alone." },
      {
        title: "Rich",
        body: "Reads alone too.",
        illustration: createRawSnippet(() => ({
          render: () => '<figure class="htp-illus">An illustration.</figure>',
        })),
        example: createRawSnippet(() => ({
          render: () => '<blockquote class="htp-example">A worked example.</blockquote>',
        })),
      },
    ];
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(
      c.manager,
      { storage: fakeStorage(), storagePrefix: "test-game" },
      () => steps.length,
    );
    const { container } = render(HowToPlayFixture, { vm, steps });

    await fireEvent.click(screen.getByRole("button", { name: "Next" })); // to the rich step
    expect(screen.getByText("An illustration.")).toBeInTheDocument();
    expect(screen.getByText("A worked example.")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Back" })); // back to the plain step
    expect(screen.getByText("Reads alone.")).toBeInTheDocument();
    expect(container.querySelector(".htp-illus")).not.toBeInTheDocument();
    expect(container.querySelector(".htp-example")).not.toBeInTheDocument();
  });

  it("moves focus in, keeps the background inert and returns focus to the opener on close", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS, withButton: true });
    await waitFor(() => expect(dialog()).toHaveFocus());
    expect(background().inert).toBe(true);

    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(dialog()).not.toBeInTheDocument();
    expect(background().inert).toBe(false);

    const button = screen.getByRole("button", { name: "How to play" });
    button.focus(); // jsdom does not implement click's focus activation behavior
    await fireEvent.click(button);
    await waitFor(() => expect(dialog()).toHaveFocus());
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(button).toHaveFocus();
  });

  it("inerts the background up to the page root while open", async () => {
    const outside = document.createElement("div");
    outside.id = "outside";
    document.body.appendChild(outside);
    try {
      const { vm } = setup();
      render(HowToPlayFixture, { vm, steps: STEPS });
      await waitFor(() => expect(dialog()).toBeInTheDocument());
      expect(outside.inert).toBe(true);
      expect(background().inert).toBe(true);

      await fireEvent.keyDown(document.body, { key: "Escape" });
      expect(outside.inert).toBe(false);
    } finally {
      outside.remove();
    }
  });

  it("closes on the close button", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    await waitFor(() => expect(dialog()).toBeInTheDocument());
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("traps Tab inside the open sheet and wraps at both ends", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    const user = userEvent.setup();
    await waitFor(() => expect(dialog()).toHaveFocus());

    await user.tab(); // → close button (first focusable)
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    for (let i = 0; i < 5; ++i) await user.tab(); // three dots, Back, Next
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    await user.tab(); // wraps to the close button
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("passes axe with the sheet open", async () => {
    const { vm } = setup();
    const { container } = render(HowToPlayFixture, { vm, steps: STEPS });
    await waitFor(() => expect(dialog()).toBeInTheDocument());
    await expectNoViolations(container, "HowToPlay");
  });

  it("runs as a carousel for a seatless viewer without taking focus or blocking the lobby", async () => {
    const timer = fakeTimer();
    const { vm } = setup(true, { timer });
    render(HowToPlayFixture, { vm, steps: STEPS });

    expect(dialog()).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "How to play" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    // never takes focus and does not block the rest of the lobby (jsdom has no `inert`, so a
    // never-touched element reads undefined — normalize to the browser's false)
    expect(document.activeElement).toBe(document.body);
    const bg = background();
    expect(bg.inert ?? false).toBe(false);
    bg.focus();
    expect(bg).toHaveFocus();

    // auto-advances every 8000ms by default and wraps around
    expect([...timer.running.values()].map((i) => i.ms)).toEqual([8000]);
    fireAll(timer);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Second step" })).toBeInTheDocument(),
    );
    fireAll(timer);
    fireAll(timer);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument(),
    );
  });

  it("stops the carousel for good on user input", async () => {
    const timer = fakeTimer();
    const { vm } = setup(true, { timer });
    render(HowToPlayFixture, { vm, steps: STEPS });
    expect(vm.carouselRunning).toBe(true);

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(vm.carouselRunning).toBe(false);
    expect(timer.running.size).toBe(0);
    vm.startCarousel(); // user input stopped it for good
    expect(vm.carouselRunning).toBe(false);
  });

  it("passes axe in carousel mode", async () => {
    const { vm } = setup(true, { timer: fakeTimer() });
    const { container } = render(HowToPlayFixture, { vm, steps: STEPS });
    expect(screen.getByRole("region", { name: "How to play" })).toBeInTheDocument();
    await expectNoViolations(container, "HowToPlay");
  });

  it("wraps Shift+Tab back to the last focusable from the first and from the sheet", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    const user = userEvent.setup();
    await waitFor(() => expect(dialog()).toHaveFocus());

    await user.tab(); // → close button (first focusable)
    await user.tab({ shift: true }); // wraps to the last focusable
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();

    screen.getByRole("dialog").focus(); // jsdom does not move focus on its own
    await user.tab({ shift: true }); // from the sheet itself, also wraps
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("lets Shift+Tab move naturally from a middle focusable", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    const user = userEvent.setup();
    await waitFor(() => expect(dialog()).toHaveFocus());

    screen.getByRole("button", { name: "Back" }).focus();
    await user.tab({ shift: true }); // no wrap: the previous dot takes focus
    const dots = screen.getAllByRole("button", { name: /^step \d of 3$/i });
    expect(dots[2]).toHaveFocus();
  });

  it("ignores keys while the sheet is closed and keys other than Tab and Escape while open", async () => {
    const storage = fakeStorage();
    storage.values.set("test-game.howToPlaySeen", "1"); // no auto-open
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(
      c.manager,
      { storage, storagePrefix: "test-game" },
      () => STEPS.length,
    );
    render(HowToPlayFixture, { vm, steps: STEPS, withButton: true });

    await fireEvent.keyDown(document.body, { key: "Escape" }); // closed: ignored
    expect(dialog()).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    await waitFor(() => expect(dialog()).toBeInTheDocument());
    await fireEvent.keyDown(document.body, { key: "Enter" }); // open, not Tab/Escape: ignored
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First step" })).toBeInTheDocument();
  });

  it("jumps to a step when its dot is clicked", async () => {
    const { vm } = setup();
    render(HowToPlayFixture, { vm, steps: STEPS });
    await waitFor(() => expect(dialog()).toBeInTheDocument());

    await fireEvent.click(screen.getByRole("button", { name: /step 3 of 3/i }));
    expect(vm.stepIndex).toBe(2);
    expect(screen.getByRole("heading", { name: "Third step" })).toBeInTheDocument();
  });

  it("stops the carousel for good when a dot is clicked", async () => {
    const timer = fakeTimer();
    const { vm } = setup(true, { timer });
    render(HowToPlayFixture, { vm, steps: STEPS });
    expect(vm.carouselRunning).toBe(true);

    await fireEvent.click(screen.getByRole("button", { name: /step 2 of 3/i }));
    expect(vm.stepIndex).toBe(1);
    expect(screen.getByRole("heading", { name: "Second step" })).toBeInTheDocument();
    expect(vm.carouselRunning).toBe(false);
    expect(timer.running.size).toBe(0);
  });

  it("renders the sheet chrome without step content for an out-of-range index", async () => {
    const storage = fakeStorage();
    storage.values.set("test-game.howToPlaySeen", "1"); // no auto-open
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(c.manager, { storage, storagePrefix: "test-game" }, () => 5);
    render(HowToPlayFixture, { vm, steps: STEPS, withButton: true });

    await fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    await waitFor(() => expect(dialog()).toBeInTheDocument());

    vm.goTo(4); // within stepCount() but beyond the rendered steps
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("degrades when the opener is not an HTMLElement and restores nothing", async () => {
    const storage = fakeStorage();
    storage.values.set("test-game.howToPlaySeen", "1"); // no auto-open
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(
      c.manager,
      { storage, storagePrefix: "test-game" },
      () => STEPS.length,
    );
    render(HowToPlayFixture, { vm, steps: STEPS, withButton: true });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("tabindex", "0");
    document.body.appendChild(svg);
    try {
      svg.focus(); // jsdom does not implement click's focus activation behavior
      await fireEvent.click(screen.getByRole("button", { name: "How to play" }));
      await waitFor(() => expect(dialog()).toBeInTheDocument());

      await fireEvent.keyDown(document.body, { key: "Escape" });
      expect(dialog()).not.toBeInTheDocument();
      expect(document.activeElement).toBe(document.body); // nothing to restore to
    } finally {
      svg.remove();
    }
  });

  it("does not restore focus to an opener that left the document", async () => {
    const storage = fakeStorage();
    storage.values.set("test-game.howToPlaySeen", "1"); // no auto-open
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(
      c.manager,
      { storage, storagePrefix: "test-game" },
      () => STEPS.length,
    );
    render(HowToPlayFixture, { vm, steps: STEPS, withButton: true });

    const button = screen.getByRole("button", { name: "How to play" });
    button.focus(); // jsdom does not implement click's focus activation behavior
    await fireEvent.click(button);
    await waitFor(() => expect(dialog()).toBeInTheDocument());

    button.remove(); // the opener leaves the document while the sheet is open
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(dialog()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });
});
