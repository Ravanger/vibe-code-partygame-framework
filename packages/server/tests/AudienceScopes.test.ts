import { describe, expect, it } from "vitest";
import { AudienceScopes } from "../src/rooms/AudienceScopes.js";

describe("AudienceScopes", () => {
  it("returns true once per key and scope, false on a repeat", () => {
    const scopes = new AudienceScopes();
    expect(scopes.once("aud-1", "vote:a")).toBe(true);
    expect(scopes.once("aud-1", "vote:a")).toBe(false);
    expect(scopes.once("aud-1", "vote:b")).toBe(true); // a new scope for an existing key
    expect(scopes.once("aud-2", "vote:a")).toBe(true); // keys are independent
  });

  it("forgets every key and scope on clear", () => {
    const scopes = new AudienceScopes();
    scopes.once("aud-1", "vote:a");
    scopes.clear();
    expect(scopes.once("aud-1", "vote:a")).toBe(true);
  });
});
