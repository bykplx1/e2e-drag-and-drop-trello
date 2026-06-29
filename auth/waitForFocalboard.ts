/**
 * Readiness gate for the hermetic Focalboard target.
 *
 * Per docs/spike-findings.md, the server answers `GET /login` with HTTP 200
 * once it is ready to serve. We poll that endpoint so no test starts against a
 * half-booted container. This runs at the top of the `setup` project, and
 * every browser project depends on `setup`, so it gates the whole suite.
 */
export async function waitForFocalboard(
  baseURL: string,
  timeoutMs = 60_000,
  intervalMs = 1_000,
): Promise<void> {
  const loginUrl = new URL('/login', baseURL).toString();
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(loginUrl, { redirect: 'manual' });
      if (response.status === 200) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Focalboard not ready at ${loginUrl} after ${timeoutMs}ms (last: ${lastError})`,
  );
}
