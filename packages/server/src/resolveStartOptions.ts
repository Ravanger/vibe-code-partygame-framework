import { RoomCodeService } from "./services/RoomCodeService.js";

export interface StartPorts {
  /** Defaults to `PORT` or 2567. */
  port?: number;
  /** Code-resolution HTTP API. Defaults to `API_PORT` or 3001. */
  apiPort?: number;
  roomCodeService?: RoomCodeService;
}

/** Fills in the ports and the shared room-code service for `startServer`. */
export function resolveStartOptions(
  options: StartPorts,
  env: Record<string, string | undefined>,
): { port: number; apiPort: number; roomCodeService: RoomCodeService } {
  return {
    port: options.port ?? Number(env.PORT ?? 2567),
    apiPort: options.apiPort ?? Number(env.API_PORT ?? 3001),
    roomCodeService: options.roomCodeService ?? new RoomCodeService(),
  };
}
