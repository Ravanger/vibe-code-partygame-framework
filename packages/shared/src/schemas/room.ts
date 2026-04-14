import { z } from 'zod';

export const RoomCodeSchema = z.string().length(4).regex(/^[A-Z0-9]+$/);
