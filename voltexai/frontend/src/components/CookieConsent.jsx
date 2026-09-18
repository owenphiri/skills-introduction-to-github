// src/components/CookieConsent.jsx — GDPR-style cookie consent banner
// Stores the viewer's choice in localStorage; essential cookies always on,
// analytics/marketing opt-in. Other code can read getConsent() to gate loading
// of analytics/marketing scripts.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "voltexai_cookie_consent_v1";

export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(consent) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...consent, ts: Date.now() }));
  } catch { /* private mode — honour for this session only */ }
  // let the rest of the app react (e.g. conditionally load analytics)
  try { window.dispatchEvent(new CustomEvent("vx-consent", { detail: consent })); } catch { /* noop */ }
}

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => { if (!getConsent()) setShow(true); }, []);

  if (!show) return null;

  const decide = (c) => { save(c); setShow(false); };

  return (
    <div className="vx-cookie" role="dialog" aria-label="Cookie preferences" aria-live="polite">
      <div className="vx-cookie-body">
        <div className="vx-cookie-text">
          <b>We value your privacy 🍪</b>
          <p>
            We use essential cookies to run VoltexAI, and — with your consent — analytics
            and marketing cookies to improve the platform. Read our{" "}
            <Link to="/privacy">Privacy Policy</Link>. You can change this anytime.
          </p>
          {custom && (
            <div className="vx-cookie-opts">
              <label className="vx-cookie-opt vx-cookie-opt--fixed">
                <input type="checkbox" checked readOnly /> <span>Essential <em>(always on)</em></span>
              </label>
              <label className="vx-cookie-opt">
                <input type="checkbox" id="vx-ck-analytics" checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)} /> <span>Analytics</span>
              </label>
              <label className="vx-cookie-opt">
                <input type="checkbox" id="vx-ck-marketing" checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)} /> <span>Marketing</span>
              </label>
            </div>
          )}
        </div>
        <div className="vx-cookie-actions">
          {!custom ? (
            <>
              <button className="vx-btn-ghost vx-btn-sm" onClick={() => setCustom(true)}>Customize</button>
              <button className="vx-btn-secondary vx-btn-sm"
                onClick={() => decide({ essential: true, analytics: false, marketing: false })}>
                Reject non-essential
              </button>
              <button className="vx-btn-primary vx-btn-sm"
                onClick={() => decide({ essential: true, analytics: true, marketing: true })}>
                Accept all
              </button>
            </>
          ) : (
            <>
              <button className="vx-btn-secondary vx-btn-sm"
                onClick={() => decide({ essential: true, analytics: false, marketing: false })}>
                Reject non-essential
              </button>
              <button className="vx-btn-primary vx-btn-sm"
                onClick={() => decide({ essential: true, analytics, marketing })}>
                Save choices
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
