import { z } from "zod";

export type UrlValidationResult =
  | { ok: true; normalizedUrl: string; hostname: string }
  | { ok: false; error: string };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export function normalizeUrlInput(input: string): UrlValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter a website URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are supported." };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "URLs with embedded credentials are not allowed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: "This URL points to a blocked local address." };
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return {
      ok: false,
      error: "This URL points to a private network address.",
    };
  }

  parsed.hash = "";
  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    hostname,
  };
}

export async function assertPublicHostname(
  hostname: string,
): Promise<UrlValidationResult> {
  const { lookup } = await import("node:dns/promises");

  try {
    const results = await lookup(hostname, { all: true });
    for (const record of results) {
      if (record.family === 4 && isPrivateIpv4(record.address)) {
        return {
          ok: false,
          error: "This URL resolves to a private network address.",
        };
      }
      if (record.family === 6 && isPrivateIpv6(record.address)) {
        return {
          ok: false,
          error: "This URL resolves to a private network address.",
        };
      }
    }
    return { ok: true, normalizedUrl: "", hostname };
  } catch {
    return { ok: false, error: "Could not resolve this domain name." };
  }
}

export const urlInputSchema = z
  .string()
  .trim()
  .min(1, "Please enter a website URL.")
  .max(2048, "URL is too long.");

export async function validateScanUrl(
  input: string,
): Promise<UrlValidationResult> {
  const schemaResult = urlInputSchema.safeParse(input);
  if (!schemaResult.success) {
    return {
      ok: false,
      error: schemaResult.error.issues[0]?.message ?? "Invalid URL.",
    };
  }

  const normalized = normalizeUrlInput(schemaResult.data);
  if (!normalized.ok) {
    return normalized;
  }

  const dnsCheck = await assertPublicHostname(normalized.hostname);
  if (!dnsCheck.ok) {
    return dnsCheck;
  }

  return normalized;
}
