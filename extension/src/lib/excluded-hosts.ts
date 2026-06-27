/** Browser-internal pages that are never scanned. */
export const EXCLUDED_URL_PREFIXES = [
  "chrome://",
  "chrome-untrusted://",
  "chrome-extension://",
  "about:",
  "edge://",
  "brave://",
] as const;

/** Popular sites skipped by auto-scan (email, chat, social, streaming, etc.). */
export const EXCLUDED_HOSTS = [
  // Google
  "google.com",
  "gmail.com",
  "youtube.com",
  // Meta
  "facebook.com",
  "instagram.com",
  "meta.com",
  "messenger.com",
  "threads.net",
  "whatsapp.com",
  // Microsoft
  "microsoft.com",
  "outlook.com",
  "live.com",
  "hotmail.com",
  "office.com",
  "office365.com",
  // Apple
  "apple.com",
  "icloud.com",
  // Social & messaging
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "reddit.com",
  "pinterest.com",
  "snapchat.com",
  "discord.com",
  "slack.com",
  "telegram.org",
  "t.me",
  "zoom.us",
  "zoom.com",
  // Email
  "yahoo.com",
  "proton.me",
  "protonmail.com",
  // Streaming & commerce
  "netflix.com",
  "spotify.com",
  "amazon.com",
  "bing.com",
] as const;

export function isExcludedUrl(url: string | undefined): boolean {
  if (!url) return true;

  const lower = url.toLowerCase();
  for (const prefix of EXCLUDED_URL_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }

  try {
    return isExcludedHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

export function isExcludedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const excluded of EXCLUDED_HOSTS) {
    if (host === excluded || host.endsWith(`.${excluded}`)) {
      return true;
    }
  }
  return false;
}
