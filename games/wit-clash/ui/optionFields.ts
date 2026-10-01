import type { z } from "zod";

export interface OptionField {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** One field per bounded numeric property of a JSON Schema object, labelled from its camelCase key. */
export function optionFields(schema: z.core.JSONSchema.BaseSchema): OptionField[] {
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
    const spaced = key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
    fields.push({
      key,
      label: spaced.charAt(0).toUpperCase() + spaced.slice(1),
      min: minimum,
      max: maximum,
    });
  }
  return fields;
}
