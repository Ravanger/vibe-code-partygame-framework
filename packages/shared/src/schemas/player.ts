import { z } from "zod";

/**
 * Schema for player names.
 * Ensures the name is between 2 and 20 characters long.
 */
export const PlayerNameSchema = z.string().min(2).max(20);

/**
 * Schema for SET_NAME action payload.
 * Trims whitespace, requires 1-20 characters.
 */
export const SetNameSchema = z.string().trim().min(1).max(20);
