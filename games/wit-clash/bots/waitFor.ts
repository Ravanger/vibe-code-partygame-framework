/** Polls until `predicate` holds, or throws `Timed out waiting for <what>`. */
export async function waitFor(
  predicate: () => boolean,
  what: string,
  timeoutMs: number,
  stepMs = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}
