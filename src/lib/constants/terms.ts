export const TERMS_VERSION = "2026-06-27";

export const TERMS_STORAGE_KEY = "darklens_terms_accepted_version";

export const TERMS_MODAL = {
  title: "Legal Disclaimer & Terms of Use",
  intro:
    "Before DarkLens scans a webpage, please read and accept the following terms. DarkLens is designed to support informed decision-making by highlighting observable design cues. It does not make legal, regulatory, fraud, safety, or intent-based findings.",
  evidenceNotice: {
    title: "Important: Automatic Evidence Capture Notice",
    body: "When you start a scan, DarkLens may automatically load the submitted public webpage, capture screenshots, extract visible text, record selected page metadata, and store evidence snippets privately for analysis, quality checks, consistency checks, and system improvement. You should only submit public webpages that you are authorised to access.",
  },
  acceptance: {
    title: "Mandatory Acceptance Required",
    body: "By proceeding, you acknowledge that you have read and understood the above terms. You agree that DarkLens provides informational automated analysis only, that screenshots and evidence may be captured automatically and stored privately, and that you remain responsible for your own decisions.",
    checkboxLabel:
      "I understand and accept the Terms of Use. I acknowledge that DarkLens may automatically capture and privately store screenshots, page text, metadata, and evidence snippets for analysis and consistency checks. I understand that DarkLens does not determine whether a website is illegal, fraudulent, unsafe, or deceptive.",
    acceptButton: "Accept and start scan",
    acceptButtonDisabled: "Accept terms to continue",
    cancelButton: "Cancel",
  },
} as const;

export const TERMS_SECTIONS = [
  {
    title: "Informational Purpose Only",
    body: "DarkLens is for informational and educational purposes only. It helps identify potential pressure tactics and design cues, but it does not provide legal, financial, cybersecurity, regulatory, or consumer protection advice.",
  },
  {
    title: "No Legal or Fraud Determination",
    body: "DarkLens does not determine whether a website, business, product, promotion, or claim is lawful, unlawful, fraudulent, dishonest, unsafe, or deceptive. Findings are limited to observable signals detected during automated analysis.",
  },
  {
    title: "Automated Analysis May Be Incorrect",
    body: "Findings are generated through automated rules, software, and/or AI-assisted analysis. Results may be inaccurate, incomplete, outdated, or affected by page layout changes, dynamic content, geolocation, cookies, A/B testing, bot detection, or scanning limitations.",
  },
  {
    title: "User Decision Responsibility",
    body: "You remain responsible for your own decisions. Do not rely solely on DarkLens before making purchases, payments, subscriptions, bookings, donations, or other online decisions. Consider checking independent reviews, refund terms, cancellation terms, seller identity, and other sources.",
  },
  {
    title: "Automatic Screenshots and Private Repository",
    body: "By starting a scan, you acknowledge that DarkLens may automatically capture and privately store screenshots, screenshot crops, visible text, page metadata, detected cues, timestamps, and scan results. These records are used internally to support evidence review, improve detection, and compare repeated claims over time. They are not intended to create a public ranking, blacklist, or name-and-shame database.",
  },
  {
    title: "Privacy and Personal Data",
    body: "Do not submit pages containing personal, confidential, account-specific, payment, medical, employment, government, or sensitive information. DarkLens is intended for public webpages only. Where possible, the system may redact or blur personal data, but redaction may not be perfect.",
  },
  {
    title: "Public Pages Only",
    body: "You must not use DarkLens to scan pages behind logins, private accounts, paywalls, CAPTCHA gates, access controls, internal systems, or pages you are not authorised to access. DarkLens should not be used to bypass technical restrictions.",
  },
  {
    title: "Third-Party Websites",
    body: "DarkLens scans third-party webpages submitted by users. We do not control those websites, their content, their availability, their claims, or their behaviour. A scan result may differ across time, location, device, cookies, session, or user profile.",
  },
  {
    title: "No Guarantee of Availability or Accuracy",
    body: "We do not guarantee that DarkLens will detect every relevant cue, that all findings are correct, or that scans will complete successfully. The absence of a finding does not mean a website is safe, fair, lawful, or free from concerning design cues.",
  },
  {
    title: "Website Owner or Affected Party Review",
    body: "If you operate or represent a website referenced in a scan result and believe a finding is inaccurate, outdated, or incomplete, you may request a review or correction through the Request review link in the footer.",
  },
  {
    title: "Limitation of Liability",
    body: "To the maximum extent permitted by applicable law, DarkLens and its operators are not liable for losses, damages, missed purchases, purchases made, reliance on scan results, business decisions, user submissions, third-party website content, or technical errors.",
  },
  {
    title: "Singapore Use / Governing Law",
    body: "This service is intended for use in Singapore unless otherwise stated. These terms are governed by Singapore law, and disputes are subject to the courts of Singapore.",
  },
] as const;
