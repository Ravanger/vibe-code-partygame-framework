import type { z } from "zod";

export interface OptionField {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** Builds form fields from a JSON Schema object. */
export class OptionFields {
  constructor(private readonly labels: Readonly<Record<string, string>> = {}) {}

  /** One field per bounded numeric property, labelled from `labels[key]` or its camelCase key. */
  from(schema: z.core.JSONSchema.BaseSchema): OptionField[] {
    const fields: OptionField[] = [];
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (typeof property !== "object") continue;
      const { type, minimum, maximum } = property;
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

  private labelOf(key: string): string {
    const spaced = key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
}
