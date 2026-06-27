import {
  HOME_DISCLAIMER,
  REPORT_DISCLAIMER,
} from "@darkpatterns/shared/wording";
import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../../lib/storage";

export function OptionsApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:3000");
  const [apiKey, setApiKey] = useState("");
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getSettings().then((settings) => {
      setApiBaseUrl(settings.apiBaseUrl);
      setApiKey(settings.apiKey);
      setAutoScanEnabled(settings.autoScanEnabled);
      setAccepted(Boolean(settings.termsAcceptedAt));
    });
  }, []);

  const handleSave = async () => {
    await saveSettings({
      apiBaseUrl: apiBaseUrl.trim(),
      apiKey: apiKey.trim(),
      autoScanEnabled,
      termsAcceptedAt: accepted ? new Date().toISOString() : null,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="panel" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Dark Patterns Detector — Options</h1>
      <p className="muted">{HOME_DISCLAIMER}</p>

      <section className="card terms-section">
        <h2>Terms of use</h2>
        <p className="small muted">{REPORT_DISCLAIMER}</p>
        <p className="small muted">
          This tool is for educational and informational purposes only. It is
          not legal, financial, or security advice.
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I understand this tool identifies potential pressure tactics and
            design cues only, and does not determine whether a website is
            unlawful, fraudulent, or unsafe.
          </span>
        </label>
      </section>

      <section className="card">
        <h2>Scanning</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoScanEnabled}
            onChange={(event) => setAutoScanEnabled(event.target.checked)}
          />
          <span>
            Automatically analyze pages when I browse (after terms accepted)
          </span>
        </label>
      </section>

      <section className="card">
        <h2>Backend connection</h2>
        <div className="field">
          <label htmlFor="api-base-url">API base URL</label>
          <input
            id="api-base-url"
            type="text"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="https://your-app.vercel.app"
          />
        </div>
        <div className="field">
          <label htmlFor="api-key">Extension API key</label>
          <input
            id="api-key"
            type="text"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Matches EXTENSION_API_KEY on server"
          />
        </div>
      </section>

      <button type="button" className="button" onClick={handleSave}>
        Save settings
      </button>
      {saved ? <p className="saved">Settings saved.</p> : null}
    </main>
  );
}
