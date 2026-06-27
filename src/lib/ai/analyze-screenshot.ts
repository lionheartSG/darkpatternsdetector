import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { scanResultSchema } from "@/lib/ai/schemas";
import { buildSafeSummary } from "@/lib/constants/wording";
import { sanitizeWording } from "@/lib/wording/sanitize";
import type { ScanResultPayload } from "@/types/scan";

const SCREENSHOT_SYSTEM_PROMPT = `You are a consumer decision-support analyst reviewing a user-provided screenshot of a public webpage.

The screenshot was captured by the user in their own browser. Analyze only what is visible in the image for observable pressure tactics and design cues.

Categories to look for:
- URGENCY: Countdown timers, limited-time messages, offer expiry wording
- SCARCITY: Low-stock messages, high-demand messages, limited quantity claims
- SNEAKING: Hidden costs, hidden subscriptions, preselected add-ons
- MISDIRECTION: Confirmshaming, visual interference, pressured selling
- SOCIAL_PROOF: Activity notifications, popularity claims, visitor counts
- OBSTRUCTION: Difficult cancellation or account exit flows
- FORCED_ACTION: Required enrollment or account creation
- PRICING_DECEPTION: Drip pricing, unclear final pricing
- NAGGING: Repeated popups, sticky pressure banners
- PRESELECTION: Pre-checked boxes for paid extras or marketing

Rules:
- Describe only what you can see in the screenshot.
- Quote or paraphrase visible text as evidence.
- Use cautious, non-accusatory language. Never call a site scam, fraud, illegal, deceptive, predatory, fake, or dishonest.
- Prefer phrases such as "potential pressure cue", "possible scarcity cue", and "may encourage faster decision-making".
- If text is unreadable, say so and lower confidence.
- riskScore 0-100 reflects overall caution level weighted by severity and confidence.`;

function getVisionModel() {
  return openai(
    process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? "gpt-5.4-nano-2026-03-17",
  );
}

export async function analyzeScreenshot(input: {
  url: string;
  base64: string;
  mimeType: string;
}): Promise<ScanResultPayload> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "Screenshot analysis requires an AI vision model. Configure OPENAI_API_KEY to continue.",
    );
  }

  const imageBuffer = Buffer.from(input.base64, "base64");

  const result = await generateObject({
    model: getVisionModel(),
    schema: scanResultSchema,
    messages: [
      { role: "system", content: SCREENSHOT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this screenshot for the public webpage: ${input.url}

Report visible pressure cues with evidence from the image. This is not a legal, fraud, safety, or regulatory determination.`,
          },
          {
            type: "image",
            image: imageBuffer,
            mediaType: input.mimeType,
          },
        ],
      },
    ],
  });

  const detections = result.object.detections.map((detection) => ({
    ...detection,
    description: sanitizeWording(detection.description),
    evidence: sanitizeWording(detection.evidence),
    patternType: sanitizeWording(detection.patternType),
  }));

  const summary = sanitizeWording(
    result.object.summary ||
      (detections.length > 0
        ? buildSafeSummary(detections.length)
        : "No major pressure cues were detected in the uploaded screenshot."),
  );

  return {
    riskScore: result.object.riskScore,
    summary,
    detections,
  };
}
