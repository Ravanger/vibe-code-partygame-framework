import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { QrCode } from "../../src/components/index.js";

describe("QrCode", () => {
  it("draws the link as a labelled svg", () => {
    const { container } = render(QrCode, { text: "http://localhost/?code=ABCD" });
    expect(screen.getByRole("img", { name: "QR code that opens the join link" })).toBe(
      container.querySelector("svg"),
    );
    expect(container.querySelector("path")?.getAttribute("d")).toMatch(/^M\d/);
  });
});
