import { type SchemaType, schema, t } from "@colyseus/schema";

/** Synced schema of one seat in the room; clients receive it inside the room state. */
export const PlayerSchema = schema(
  {
    id: t.string().default(""),
    name: t.string().default(""),
    role: t.string<"host" | "player">().default("player"),
    isReady: t.boolean().default(false),
    isConnected: t.boolean().default(true),
    isActive: t.boolean().default(true),
  },
  "PlayerSchema",
);
/** The instance type of {@link PlayerSchema}. */
export type PlayerSchema = SchemaType<typeof PlayerSchema>;
