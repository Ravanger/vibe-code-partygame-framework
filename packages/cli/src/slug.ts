/**
 * Names that would collide with the root dispatcher's commands and launch modes. Mirrors `RESERVED` in
 * `scripts/gameEntry.ts`, which is not exported; keep the two lists in sync if either changes.
 */
const RESERVED = ["list", "launch", "play", "bots", "dev", "host", "prod"];

// The first word must start with a letter: the slug is turned into identifiers (`PascalName`, `camelName`),
// which cannot begin with a digit.
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export type ParseSlugResult = { ok: true; slug: string } | { ok: false; error: string };

/** Validates a game folder name. Kebab-case, not reserved. */
export function parseSlug(input: unknown): ParseSlugResult {
  if (typeof input !== "string") return { ok: false, error: "slug must be a string" };
  if (!SLUG.test(input)) {
    return {
      ok: false,
      error: `invalid slug "${input}": use kebab-case [a-z][a-z0-9]*(-[a-z0-9]+)*, starting with a letter`,
    };
  }
  if (RESERVED.includes(input)) {
    return { ok: false, error: `"${input}" is a reserved name` };
  }
  return { ok: true, slug: input };
}

/** The five names the template substitutes, all derived from a validated slug. */
export interface Names {
  /** `my-game`. */
  slug: string;
  /** `MyGame`. */
  pascalName: string;
  /** `myGame`. */
  camelName: string;
  /** `My Game`. */
  displayName: string;
  /** `my_game`. */
  roomName: string;
}

export function deriveNames(slug: string): Names {
  const words = slug.split("-");
  const titled = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const pascalName = titled.join("");
  return {
    slug,
    pascalName,
    camelName: pascalName.charAt(0).toLowerCase() + pascalName.slice(1),
    displayName: titled.join(" "),
    roomName: slug.replaceAll("-", "_"),
  };
}
