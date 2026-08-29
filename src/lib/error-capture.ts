import { AsyncLocalStorage } from "node:async_hooks";

type ErrorSlot = { error?: unknown };

// Per-request slot so a captured error can only ever be consumed by the request
// whose async context produced it — never a concurrent sibling sharing this
// long-lived isolate/process. Falling out of context just means no capture
// (consume returns undefined), which is correct: it isn't this request's error.
const requestErrors = new AsyncLocalStorage<ErrorSlot>();

function record(error: unknown) {
  const slot = requestErrors.getStore();
  if (slot) slot.error = error; // last-write-wins within the same request
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function runWithErrorCapture<T>(fn: () => T): T {
  return requestErrors.run({}, fn);
}

export function consumeLastCapturedError(): unknown {
  const slot = requestErrors.getStore();
  if (!slot) return undefined;
  const { error } = slot;
  slot.error = undefined;
  return error;
}
