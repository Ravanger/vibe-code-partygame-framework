import { z } from 'zod';

/**
 * Schema for player names.
 * Ensures the name is between 2 and 20 characters long.
 */
export const PlayerNameSchema = z.string().min(2).max(20);
