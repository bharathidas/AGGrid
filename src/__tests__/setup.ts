// Deterministic number formatting regardless of the machine locale.
Object.defineProperty(globalThis, "navigator", { value: { language: "en-US" }, configurable: true, writable: true });
