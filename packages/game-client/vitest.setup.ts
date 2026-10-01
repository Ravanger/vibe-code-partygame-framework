// jsdom leaves Node's experimental webstorage getter on globalThis, and @colyseus/sdk
// reads localStorage while constructing Auth — which emits an ExperimentalWarning.
// Defining our own stores ahead of any test shadows that getter.
function createStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(globalThis, name, {
    value: createStorage(),
    configurable: true,
    writable: true,
  });
}

// Node's built-in WebSocket dispatches events jsdom's Event does not recognise, and the SDK picks
// its WebSocket once, at import. Hide the global just long enough for it to fall back to `ws`.
const nodeWebSocket = globalThis.WebSocket;
Reflect.deleteProperty(globalThis, "WebSocket");
await import("@colyseus/sdk");
globalThis.WebSocket = nodeWebSocket;

export {};
