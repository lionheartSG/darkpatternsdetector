const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ParsedScreenshot =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; error: string };

export function parseUserScreenshot(
  input: string,
  mimeTypeHint?: string,
): ParsedScreenshot {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Please upload a screenshot image (PNG, JPEG, or WebP).",
    };
  }

  let base64 = trimmed;
  let mimeType = mimeTypeHint ?? "image/png";

  const dataUrlMatch = trimmed.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2];
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: "Only PNG, JPEG, or WebP screenshots are supported.",
    };
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return {
        ok: false,
        error: "The uploaded screenshot appears to be empty.",
      };
    }
    if (buffer.length > MAX_SCREENSHOT_BYTES) {
      return {
        ok: false,
        error: "Screenshot is too large. Please upload an image under 4 MB.",
      };
    }
  } catch {
    return { ok: false, error: "The uploaded screenshot could not be read." };
  }

  return { ok: true, base64, mimeType };
}

export async function readScreenshotFile(
  file: File,
): Promise<ParsedScreenshot> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Only PNG, JPEG, or WebP screenshots are supported.",
    };
  }

  if (file.size > MAX_SCREENSHOT_BYTES) {
    return {
      ok: false,
      error: "Screenshot is too large. Please upload an image under 4 MB.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    base64: buffer.toString("base64"),
    mimeType: file.type,
  };
}
