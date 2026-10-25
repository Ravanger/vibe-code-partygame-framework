import { Server, type ServerOptions, type Transport } from "@colyseus/core";

/** A Colyseus {@link Server} that also exposes when its transport (and thus its HTTP server) is ready. */
export class GameColyseusServer extends Server {
  /** Resolves with the transport this server will listen on. */
  readonly transportReady: Promise<Transport>;

  constructor(options?: ServerOptions) {
    super(options);
    // `_onTransportReady` is protected; capture its promise here, inside the class.
    this.transportReady = this._onTransportReady.promise;
  }
}

/**
 * Listens the Colyseus `server` on `port`. Colyseus' own `listen` never settles when the port was
 * taken after we discovered it: its transport prints the EADDRINUSE and drops it. This waits for
 * the server's transport, then races the bind against the HTTP server's error event so a sniped
 * port rejects observably instead of hanging. A failure shuts the half-booted server down, leaving
 * nothing listening.
 */
export async function listenGameServer(server: GameColyseusServer, port: number): Promise<void> {
  const transport = await server.transportReady;
  const httpServer = transport.server;
  try {
    if (httpServer === undefined) {
      throw new Error("listenGameServer requires a transport backed by an HTTP server");
    }
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        httpServer.removeListener("error", onError);
        reject(error);
      };
      httpServer.once("error", onError);
      server.listen(port).then(
        () => {
          httpServer.removeListener("error", onError);
          resolve();
        },
        (error: unknown) => {
          httpServer.removeListener("error", onError);
          reject(error);
        },
      );
    });
  } catch (error) {
    await server.gracefullyShutdown(false);
    throw error;
  }
}
