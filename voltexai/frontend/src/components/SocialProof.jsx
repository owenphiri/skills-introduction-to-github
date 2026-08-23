// src/components/SocialProof.jsx — bottom-left activity toasts (course sales,
// leaderboard finishes, signups) that cycle across all pages. Dismissible.
import { useEffect, useRef, useState } from "react";
import { socialService } from "../services/social";

const ICONS = { purchase: "🎓", leaderboard: "🏆", signup: "⚡" };
const VERB = { purchase: "just", leaderboard: "", signup: "just" };

export function SocialProof() {
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("vx_proof_off") === "1"; } catch { return false; }
  });
  const timer = useRef(null);

  useEffect(() => {
    if (dismissed) return;
    socialService.proof().then((d) => setEvents(d.events || [])).catch(() => {});
  }, [dismissed]);

  useEffect(() => {
    if (dismissed || events.length === 0) return;
    // show ~4.5s, hide ~5.5s, then advance
    let alive = true;
    const cycle = () => {
      if (!alive) return;
      setShow(true);
      timer.current = setTimeout(() => {
        if (!alive) return;
        setShow(false);
        timer.current = setTimeout(() => {
          if (!alive) return;
          setIdx((i) => (i + 1) % events.length);
          cycle();
        }, 5500);
      }, 4500);
    };
    const start = setTimeout(cycle, 3000);
    return () => { alive = false; clearTimeout(start); clearTimeout(timer.current); };
  }, [events, dismissed]);

  if (dismissed || events.length === 0) return null;
  const e = events[idx];

  return (
    <div className={`vx-proof ${show ? "in" : ""}`} role="status" aria-live="polite">
      <span className="vx-proof-icon">{ICONS[e.type] || "✨"}</span>
      <div className="vx-proof-body">
        <p><b>{e.name}</b> from {e.location}</p>
        <p className="vx-proof-detail">{VERB[e.type] ? `${VERB[e.type]} ` : ""}{e.detail}</p>
        <small>{e.mins_ago} min ago · <span className="vx-proof-verified">⚡ VoltexAI</span></small>
      </div>
      <button className="vx-proof-close" aria-label="dismiss"
        onClick={() => { try { sessionStorage.setItem("vx_proof_off", "1"); } catch {} setDismissed(true); }}>
        ×
      </button>
    </div>
  );
}
