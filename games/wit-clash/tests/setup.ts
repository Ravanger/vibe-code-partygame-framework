// Node's built-in WebSocket dispatches events jsdom's Event does not recognise, and the SDK picks
// its WebSocket once, at import. Hide the global just long enough for it to fall back to `ws`.
const nodeWebSocket = globalThis.WebSocket;
Reflect.deleteProperty(globalThis, "WebSocket");
await import("@colyseus/sdk");
globalThis.WebSocket = nodeWebSocket;

export {};
