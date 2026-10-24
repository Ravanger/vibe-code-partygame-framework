import { z } from "zod";
import { RoomCodeService } from "./services/RoomCodeService.js";

export interface StartPorts {
  /** Defaults to `PORT` or 2567. */
  port?: number;
  /** Code-resolution HTTP API. Defaults to `API_PORT` or 3001. */
  apiPort?: number;
  roomCodeService?: RoomCodeService;
  /** Origins allowed to read the code API; loopback only when omitted. */
  allowedOrigins?: string[] | "*";
}

const portFrom = (name: string, raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback;
  const parsed = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .safeParse(raw);
  if (!parsed.success) throw new Error(`${name} must be a whole number from 1 to 65535`);
  return parsed.data;
};

/** Fills in the ports and the shared room-code service for `startServer`. */
export function resolveStartOptions(
  options: StartPorts,
  env: Record<string, string | undefined>,
): {
  port: number;
  apiPort: number;
  roomCodeService: RoomCodeService;
  allowedOrigins?: string[] | "*";
} {
  return {
    port: options.port ?? portFrom("PORT", env.PORT, 2567),
    apiPort: options.apiPort ?? portFrom("API_PORT", env.API_PORT, 3001),
    roomCodeService: options.roomCodeService ?? new RoomCodeService(),
    ...(options.allowedOrigins !== undefined ? { allowedOrigins: options.allowedOrigins } : {}),
  };
}
