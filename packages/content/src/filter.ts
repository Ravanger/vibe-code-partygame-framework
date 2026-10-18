import {
  DataSet,
  type EnglishProfaneWord,
  englishDataset,
  englishRecommendedTransformers,
  type PhraseContainer,
  RegExpMatcher,
} from "obscenity";

/**
 * How strictly text is filtered: `"off"` passes everything; `"moderate"` fails slurs and profanity
 * but passes mild terms; `"strict"` fails the full dataset, mild terms included.
 */
export type FilterLevel = "off" | "moderate" | "strict";

/**
 * The outcome of a filter check. On rejection `reason` is a short fixed string that names the
 * level and never contains the matched word.
 */
export type FilterResult = { ok: true } | { ok: false; reason: string };

/** Checks free text (answers, player names) against a profanity dataset. Synchronous and side-effect free. */
export interface TextFilter {
  check(text: string, level: FilterLevel): FilterResult;
}

const MODERATE_REASON = "contains inappropriate language";
const STRICT_REASON = "contains strong language";

/**
 * Terms from the obscenity dataset that are mild enough to pass at `moderate`; only `strict`
 * blocks them. Everything else in the dataset (slurs, profanity, explicit terms) fails both levels.
 */
const MILD_TERMS = new Set<string>([
  "arse",
  "ass",
  "bastard",
  "bitch",
  "boob",
  "cock",
  "cum",
  "dick",
  "piss",
  "porn",
  "prick",
  "sex",
  "turd",
  "tit",
  "twat",
]);

let moderateMatcher: RegExpMatcher | undefined;
let strictMatcher: RegExpMatcher | undefined;

/** Every phrase in `englishDataset` sets `originalWord` metadata; the optional type is a DataSet API artifact. */
const originalWordOf = (phrase: PhraseContainer<{ originalWord: EnglishProfaneWord }>): string =>
  (phrase.metadata as { originalWord: EnglishProfaneWord }).originalWord;

function buildMatcher(level: "moderate" | "strict"): RegExpMatcher {
  const dataset =
    level === "strict"
      ? englishDataset
      : new DataSet<{ originalWord: EnglishProfaneWord }>()
          .addAll(englishDataset)
          .removePhrasesIf((phrase) => MILD_TERMS.has(originalWordOf(phrase)));
  return new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers });
}

function matcherFor(level: FilterLevel): RegExpMatcher | undefined {
  if (level === "off") return undefined;
  if (level === "moderate") {
    moderateMatcher ??= buildMatcher("moderate");
    return moderateMatcher;
  }
  strictMatcher ??= buildMatcher("strict");
  return strictMatcher;
}

/**
 * The default English {@link TextFilter}, backed by the `obscenity` dataset and its recommended
 * transformers (case folding, confusables, leet-speak such as `$` for `s`, repeated-letter
 * collapse). Matchers are built lazily on first use and shared between filters.
 */
export function createTextFilter(): TextFilter {
  return {
    check(text, level) {
      const matcher = matcherFor(level);
      if (matcher === undefined || !matcher.hasMatch(text)) return { ok: true };
      return { ok: false, reason: level === "moderate" ? MODERATE_REASON : STRICT_REASON };
    },
  };
}
