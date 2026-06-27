import { assessPageAccess, type PageAccessStatus } from "@/lib/page-access";
import type { Page } from "playwright-core";

export type FetchedPage = {
  finalUrl: string;
  pageTitle: string;
  visibleText: string;
  interactiveHtml: string;
  viewportScreenshot: string;
  fullPageScreenshot: string;
  screenshotCapturedAt: Date;
  httpStatus: number;
  access: PageAccessStatus;
};

const FETCH_TIMEOUT_MS = 45_000;
const MAX_STORED_SCREENSHOT_CHARS = 500_000;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const STEALTH_LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

const BOT_CHALLENGE_URL_PATTERNS = [
  /\/\.well-known\/sgcaptcha/i,
  /\/\.well-known\/captcha/i,
];

const BOT_CHALLENGE_RESOLVE_TIMEOUT_MS = 35_000;

const COUNTDOWN_SELECTORS = [
  "[class*='countdown' i]",
  "[id*='countdown' i]",
  "[class*='timer' i]",
  "[id*='timer' i]",
  "[data-countdown]",
  "[data-timer]",
  "[role='timer']",
].join(", ");

function isBotChallengeUrl(url: string): boolean {
  return BOT_CHALLENGE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

async function waitForBotChallengeResolution(page: Page): Promise<void> {
  if (!isBotChallengeUrl(page.url())) {
    return;
  }

  try {
    await page.waitForURL(
      (url) => !isBotChallengeUrl(url.toString()),
      {
        timeout: BOT_CHALLENGE_RESOLVE_TIMEOUT_MS,
        waitUntil: "domcontentloaded",
      },
    );
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(2000);
  } catch {
    // The host's bot challenge did not finish within the allowed window.
  }
}

async function getBrowser() {
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwrightChromium } = await import("playwright-core");

    chromium.setGraphicsMode = false;

    return playwrightChromium.launch({
      args: [...chromium.args, ...STEALTH_LAUNCH_ARGS],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: STEALTH_LAUNCH_ARGS,
  });
}

async function createBrowserContext(
  browser: Awaited<ReturnType<typeof getBrowser>>,
) {
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1366, height: 768 },
    locale: "en-SG",
    timezoneId: "Asia/Singapore",
    extraHTTPHeaders: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-SG,en;q=0.9",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-SG", "en"],
    });
  });

  return context;
}

export function trimScreenshotForStorage(base64: string): string | null {
  if (!base64 || base64.length > MAX_STORED_SCREENSHOT_CHARS) {
    return null;
  }
  return base64;
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const browser = await getBrowser();

  try {
    const context = await createBrowserContext(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(FETCH_TIMEOUT_MS);

    let latestDocumentStatus = 0;
    page.on("response", (res) => {
      if (res.request().resourceType() === "document") {
        latestDocumentStatus = res.status();
      }
    });

    let response = await page.goto(url, {
      waitUntil: "load",
      timeout: FETCH_TIMEOUT_MS,
    });

    if (!response || response.status() >= 400) {
      await page.waitForTimeout(1500);
      response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: FETCH_TIMEOUT_MS,
      });
    }

    const initialStatus = response?.status() ?? latestDocumentStatus;
    if (initialStatus === 202 || isBotChallengeUrl(page.url())) {
      await waitForBotChallengeResolution(page);
    }

    let httpStatus = latestDocumentStatus || (response?.status() ?? 0);
    if (!isBotChallengeUrl(page.url()) && httpStatus === 202) {
      httpStatus = 200;
    }

    await page.waitForTimeout(2000);

    try {
      await page.waitForSelector(COUNTDOWN_SELECTORS, { timeout: 8000 });
    } catch {
      // Dynamic timers may load later or not exist on this page.
    }

    await page.waitForTimeout(1000);

    const viewportScreenshot = (
      await page.screenshot({ type: "png", fullPage: false })
    ).toString("base64");

    const fullPageScreenshot = (
      await page.screenshot({ type: "png", fullPage: true })
    ).toString("base64");

    const data = await page.evaluate((countdownSelector) => {
      const interactiveSelectors = [
        "input",
        "button",
        "select",
        "textarea",
        "[role='timer']",
        "[class*='countdown']",
        "[id*='countdown']",
        "[class*='timer']",
        "[class*='popup']",
        "[class*='modal']",
        "[class*='stock']",
        "[class*='urgency']",
      ].join(",");

      const interactiveNodes = Array.from(
        document.querySelectorAll(interactiveSelectors),
      )
        .slice(0, 100)
        .map((node) => {
          const element = node as HTMLElement;
          const tag = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : "";
          const className = element.className
            ? `.${String(element.className).split(" ").slice(0, 3).join(".")}`
            : "";
          const text = element.innerText?.trim().slice(0, 160) ?? "";
          const checked =
            element instanceof HTMLInputElement && element.checked
              ? " checked"
              : "";
          return `<${tag}${id}${className}${checked}>${text}</${tag}>`;
        });

      const countdownNodes = Array.from(
        document.querySelectorAll(countdownSelector),
      )
        .slice(0, 20)
        .map((node) => (node as HTMLElement).innerText?.trim() ?? "")
        .filter(Boolean);

      const bodyText =
        document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";

      return {
        pageTitle: document.title,
        visibleText: bodyText,
        interactiveHtml: [
          ...interactiveNodes,
          ...countdownNodes.map((text) => `<countdown>${text}</countdown>`),
        ].join("\n"),
      };
    }, COUNTDOWN_SELECTORS);

    const access = assessPageAccess({
      httpStatus,
      pageTitle: data.pageTitle,
      visibleText: data.visibleText,
    });

    return {
      finalUrl: page.url(),
      pageTitle: data.pageTitle,
      visibleText: data.visibleText.slice(0, 12_000),
      interactiveHtml: data.interactiveHtml.slice(0, 8_000),
      viewportScreenshot,
      fullPageScreenshot,
      screenshotCapturedAt: new Date(),
      httpStatus,
      access,
    };
  } finally {
    await browser.close();
  }
}
