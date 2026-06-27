import { TERMS_STORAGE_KEY, TERMS_VERSION } from "@/lib/constants/terms";

export function getAcceptedTermsVersion(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TERMS_STORAGE_KEY);
}

export function setAcceptedTermsVersion(version: string = TERMS_VERSION): void {
  window.localStorage.setItem(TERMS_STORAGE_KEY, version);
}

export function hasAcceptedCurrentTerms(): boolean {
  return getAcceptedTermsVersion() === TERMS_VERSION;
}
