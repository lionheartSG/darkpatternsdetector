const LOAD_TIMEOUT_MS = 15_000;
const SETTLE_MS = 2_000;

export async function waitForPageReady(
  settleMs = SETTLE_MS,
): Promise<void> {
  await waitForDocumentLoad(LOAD_TIMEOUT_MS);

  if (settleMs > 0) {
    await delay(settleMs);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForDocumentLoad(timeoutMs: number): Promise<void> {
  if (document.readyState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    const timeout = window.setTimeout(finish, timeoutMs);
    window.addEventListener("load", finish, { once: true });
  });
}
