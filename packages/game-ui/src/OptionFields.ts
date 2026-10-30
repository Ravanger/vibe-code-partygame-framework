import type { z } from "zod";

/** A bounded number option: a number input with `step` (1 for integers, the schema's `multipleOf`, else "any"). */
interface NumberOptionField {
  kind: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number | "any";
}

/** A boolean option: a checkbox. */
interface BooleanOptionField {
  kind: "boolean";
  key: string;
  label: string;
}

/** A string-enum option: one control per choice. */
interface SelectOptionField {
  kind: "select";
  key: string;
  label: string;
  choices: readonly string[];
}

/** A free-text option: a text input, bounded by `maxLength` when the schema bounds it. */
interface TextOptionField {
  kind: "text";
  key: string;
  label: string;
  maxLength?: number;
}

/** One row of the generated settings form. */
export type OptionField =
  | NumberOptionField
  | BooleanOptionField
  | SelectOptionField
  | TextOptionField;

type OptionProperty = z.core.JSONSchema.JSONSchema;

/** Why an option cannot be rendered in the settings form. */
const reasonFor = (property: OptionProperty): string => {
  if (property.type === "integer" || property.type === "number") {
    return "unbounded numbers need a minimum and maximum";
  }
  if (property.enum !== undefined) return "enum choices must all be strings";
  return `unsupported type ${JSON.stringify(property.type ?? "unknown")}`;
};

/** Builds form fields from a JSON Schema object. */
export class OptionFields {
  /** Keys already reported by this instance's default `onUnsupported`. */
  private readonly warnedKeys = new Set<string>();

  constructor(
    private readonly labels: Readonly<Record<string, string>> = {},
    /** Reports each option the form cannot render; the default is a console warning, once per key per instance. */
    private readonly onUnsupported: (key: string, reason: string) => void = (key, reason) => {
      if (this.warnedKeys.has(key)) return;
      this.warnedKeys.add(key);
      console.warn(`settings form: option "${key}" is not rendered - ${reason}`);
    },
  ) {}

  /** One field per renderable option (bounded number, boolean, string enum, string); anything else goes to `onUnsupported`. */
  from(schema: z.core.JSONSchema.BaseSchema): OptionField[] {
    const fields: OptionField[] = [];
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (typeof property !== "object") continue;
      const field = this.fieldOf(key, property);
      if (field === undefined) {
        this.onUnsupported(key, reasonFor(property));
        continue;
      }
      fields.push(field);
    }
    return fields;
  }

  private fieldOf(key: string, property: OptionProperty): OptionField | undefined {
    const label = this.labels[key] ?? this.labelOf(key);
    if (property.type === "boolean") return { kind: "boolean", key, label };
    if (property.type === "string") {
      if (property.enum !== undefined) {
        if (!this.stringChoices(property.enum)) return undefined;
        return { kind: "select", key, label, choices: property.enum };
      }
      const { maxLength } = property;
      return { kind: "text", key, label, ...(maxLength === undefined ? {} : { maxLength }) };
    }
    if (property.type === "integer" || property.type === "number") {
      const { minimum, maximum } = property;
      if (minimum === undefined || maximum === undefined) return undefined;
      return {
        kind: "number",
        key,
        label,
        min: minimum,
        max: maximum,
        step: this.stepOf(property),
      };
    }
    return undefined;
  }

  private stepOf(property: OptionProperty): number | "any" {
    if (property.type === "integer") return 1;
    return property.multipleOf ?? "any";
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
