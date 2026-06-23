// Bounds an awaitable so a stalled network/RPC call can never hang the caller indefinitely.
// The underlying promise may keep running after a timeout (we cannot abort the Soroban SDK's
// fetch), but the caller proceeds — this is what stops a frozen re-sim from freezing the whole
// collector tick loop (no tick → no exit → no Docker restart) or a web request.
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${label} exceeded ${ms}ms`)), ms);
    timer.unref?.(); // never keep the process alive just for this watchdog
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
