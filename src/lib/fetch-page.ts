export type FetchedPage = {
  finalUrl: string;
  pageTitle: string;
  visibleText: string;
  interactiveHtml: string;
};

const FETCH_TIMEOUT_MS = 30_000;

async function getBrowser() {
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwrightChromium } = await import("playwright-core");

    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const browser = await getBrowser();

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; DarkPatternDetector/1.0; +https://darkpatterndetector.local)",
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(FETCH_TIMEOUT_MS);

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "media") {
        void route.abort();
        return;
      }
      void route.continue();
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: FETCH_TIMEOUT_MS,
    });
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
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
      ].join(",");

      const interactiveNodes = Array.from(
        document.querySelectorAll(interactiveSelectors),
      )
        .slice(0, 80)
        .map((node) => {
          const element = node as HTMLElement;
          const tag = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : "";
          const className = element.className
            ? `.${String(element.className).split(" ").slice(0, 3).join(".")}`
            : "";
          const text = element.innerText?.trim().slice(0, 120) ?? "";
          const checked =
            element instanceof HTMLInputElement && element.checked
              ? " checked"
              : "";
          return `<${tag}${id}${className}${checked}>${text}</${tag}>`;
        });

      return {
        pageTitle: document.title,
        visibleText:
          document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "",
        interactiveHtml: interactiveNodes.join("\n"),
      };
    });

    return {
      finalUrl: page.url(),
      pageTitle: data.pageTitle,
      visibleText: data.visibleText.slice(0, 12_000),
      interactiveHtml: data.interactiveHtml.slice(0, 8_000),
    };
  } finally {
    await browser.close();
  }
}
