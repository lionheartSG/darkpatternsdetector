/** Sparticuz release matching @sparticuz/chromium-min@131.0.1 */
export const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function launchServerlessBrowser(extraArgs: string[] = []) {
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const { chromium: playwrightChromium } = await import("playwright-core");

  chromium.setGraphicsMode = false;

  const packUrl = process.env.CHROMIUM_REMOTE_EXEC_PATH ?? DEFAULT_CHROMIUM_PACK_URL;
  const executablePath = await chromium.executablePath(packUrl);

  return playwrightChromium.launch({
    args: [...chromium.args, ...extraArgs],
    executablePath,
    headless: true,
  });
}
