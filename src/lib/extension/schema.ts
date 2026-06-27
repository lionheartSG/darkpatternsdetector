import { DETECTION_CATEGORIES } from "@darkpatterns/shared/types";
import { z } from "zod";

const heuristicSignalSchema = z.object({
  category: z.enum(DETECTION_CATEGORIES),
  patternType: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  description: z.string(),
  evidence: z.string(),
  confidence: z.number(),
  source: z.literal("heuristic"),
});

export const extensionAnalyzeSchema = z.object({
  url: z.string().url().max(2048),
  pageTitle: z.string().max(500),
  visibleText: z.string().max(12000),
  interactiveHtml: z.string().max(12000),
  pageType: z.enum(["editorial", "general"]).optional().default("general"),
  heuristicSignals: z.array(heuristicSignalSchema).max(50),
  scannedAt: z.string().datetime(),
  source: z.literal("chrome-extension"),
  force: z.boolean().optional().default(false),
});

export type ExtensionAnalyzeInput = z.infer<typeof extensionAnalyzeSchema>;
