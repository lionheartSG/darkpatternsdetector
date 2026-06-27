import { PROHIBITED_WORDS } from "@/lib/constants/wording";

const REPLACEMENTS: Record<string, string> = {
  scam: "concerning cue",
  fraud: "concerning cue",
  fraudulent: "concerning",
  criminal: "concerning",
  illegal: "concerning",
  unlawful: "concerning",
  cheating: "concerning",
  dishonest: "concerning",
  "predatory business": "pressure-related",
  predatory: "pressure-related",
  deceptive: "pressure-related",
  deception: "pressure cue",
  "dark pattern": "design cue",
  fake: "unverified",
  misleading: "may encourage faster decision-making",
  guilty: "concerning",
};

function replaceProhibitedTerm(match: string): string {
  const key = match.toLowerCase();
  return REPLACEMENTS[key] ?? "concerning cue";
}

export function sanitizeWording(text: string): string {
  let result = text;

  const multiWordPhrases = PROHIBITED_WORDS.filter((word) =>
    word.includes(" "),
  );
  for (const phrase of multiWordPhrases) {
    const pattern = new RegExp(
      phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    result = result.replace(pattern, () => replaceProhibitedTerm(phrase));
  }

  for (const word of PROHIBITED_WORDS) {
    if (word.includes(" ")) continue;
    const pattern = new RegExp(
      `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    result = result.replace(pattern, (match) => replaceProhibitedTerm(match));
  }

  return result.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeScanTextFields<T extends Record<string, string>>(
  fields: T,
): T {
  const sanitized = { ...fields };
  for (const key of Object.keys(sanitized) as Array<keyof T>) {
    sanitized[key] = sanitizeWording(String(sanitized[key])) as T[keyof T];
  }
  return sanitized;
}
