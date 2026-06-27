import { z } from "zod";
import { DETECTION_CATEGORIES } from "@/types/scan";

export const scanResultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  summary: z.string(),
  detections: z.array(
    z.object({
      category: z.enum(DETECTION_CATEGORIES),
      patternType: z.string(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
      description: z.string(),
      evidence: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type ScanResultSchema = z.infer<typeof scanResultSchema>;
