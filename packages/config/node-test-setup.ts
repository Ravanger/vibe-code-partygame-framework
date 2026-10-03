import { WebSocket as NodeWebSocket } from "ws";

// Node < 21 has no global WebSocket, but @colyseus/core's reconnect path reads the bare global
// (`WebSocket.OPEN`), so node test workers define it before any Colyseus import. Environments that
// already provide one (Bun, newer Node) keep their own.
if (Reflect.get(globalThis, "WebSocket") === undefined) {
  Object.defineProperty(globalThis, "WebSocket", {
    value: NodeWebSocket,
    configurable: true,
    writable: true,
  });
}
