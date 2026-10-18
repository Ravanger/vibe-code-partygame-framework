import type { z } from "zod";

export interface OptionField {
  key: string;
  label: string;
  /** Bounds of a number field. */
  min?: number;
  max?: number;
  /** The choices of a string-enum field; the form renders a select, not a number input. */
  options?: readonly string[];
}

/** Builds form fields from a JSON Schema object. */
export class OptionFields {
  constructor(private readonly labels: Readonly<Record<string, string>> = {}) {}

  /** One field per bounded numeric or string-enum property, labelled from `labels[key]` or its camelCase key. */
  from(schema: z.core.JSONSchema.BaseSchema): OptionField[] {
    const fields: OptionField[] = [];
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (typeof property !== "object") continue;
      const { type, minimum, maximum, enum: choices } = property;
      if (type === "string" && this.stringChoices(choices)) {
        fields.push({
          key,
          label: this.labels[key] ?? this.labelOf(key),
          options: choices,
        });
        continue;
      }
      if (
        (type !== "integer" && type !== "number") ||
        minimum === undefined ||
        maximum === undefined
      ) {
        continue;
      }
      fields.push({
        key,
        label: this.labels[key] ?? this.labelOf(key),
        min: minimum,
        max: maximum,
      });
    }
    return fields;
  }

  private stringChoices(
    choices: ReadonlyArray<string | number | boolean | null> | undefined,
  ): choices is readonly string[] {
    return (
      Array.isArray(choices) && choices.length > 0 && choices.every((c) => typeof c === "string")
    );
  }

  private labelOf(key: string): string {
    const spaced = key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
}
