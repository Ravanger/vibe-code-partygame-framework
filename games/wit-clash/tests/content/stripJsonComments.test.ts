import { describe, expect, it } from "vitest";
import { stripJsonComments } from "../../src/content/stripJsonComments.js";

describe("stripJsonComments", () => {
  it("removes line comments", () => {
    expect(stripJsonComments('{"a": 1} // comment')).toBe('{"a": 1} ');
  });

  it("removes block comments", () => {
    expect(stripJsonComments('{"a": 1} /* block */')).toBe('{"a": 1} ');
  });

  it("preserves // inside string literals", () => {
    const input = '{"url": "https://example.com"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("preserves /* */ inside string literals", () => {
    const input = '{"text": "not a /* comment */"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("handles escaped quotes inside strings", () => {
    const input = '{"text": "she said \\"hello\\" // not a comment"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("handles multiple comments", () => {
    const input = `// header
{
  "a": 1 // inline
  /* block */
}`;
    const result = stripJsonComments(input);
    expect(result).not.toContain("// header");
    expect(result).not.toContain("// inline");
    expect(result).not.toContain("/* block */");
    expect(result).toContain('"a": 1');
  });

  it("leaves valid JSON unchanged", () => {
    const valid = '{"foo": "bar", "baz": [1, 2, 3]}';
    expect(stripJsonComments(valid)).toBe(valid);
  });
});
