// src/components/SubscriberTracker.jsx — live global subscriber counter.
// Polls /api/live/subscribers and ticks up smoothly between polls using per_min.
import { useEffect, useRef, useState } from "react";
import { subscribersService } from "../services/hub";

function useCountUp(target) {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current;
    if (from === target) return;
    const start = performance.now();
    const dur = 900;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else ref.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

export function SubscriberTracker({ compact = false }) {
  const [d, setD] = useState(null);
  const [target, setTarget] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => subscribersService.live().then((r) => {
      if (!alive) return;
      setD(r); setTarget(r.total);
    }).catch(() => {});
    load();
    const poll = setInterval(load, 20000);
    // smooth optimistic ticks between polls (per_min ~ fractions/sec)
    const tick = setInterval(() => setTarget((t) => t + (d?.per_min ? Math.max(1, Math.round(d.per_min)) : 1)), 12000);
    return () => { alive = false; clearInterval(poll); clearInterval(tick); };
  }, [d?.per_min]);

  const shown = useCountUp(target);
  if (!d) return null;

  return (
    <section className={`vx-subtrack ${compact ? "compact" : ""}`}>
      <div className="vx-subtrack-main">
        <span className="vx-live-badge">● LIVE</span>
        <div>
          <div className="vx-subtrack-count">{shown.toLocaleString()}</div>
          <div className="vx-subtrack-label">traders on VoltexAI across {d.countries} countries</div>
        </div>
      </div>
      {!compact && (
        <>
          <div className="vx-subtrack-regions">
            {d.regions.map((r) => (
              <div key={r.name} className="vx-subtrack-region">
                <span>{r.flag} {r.name}</span>
                <b>{r.count.toLocaleString()}</b>
              </div>
            ))}
          </div>
          <div className="vx-subtrack-recent">
            {d.recent.slice(0, 4).map((j, i) => (
              <div key={i} className="vx-subtrack-join">
                <span>{j.flag}</span> New trader from <b>{j.city}, {j.country}</b>
                <small>{j.ago_s}s ago</small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
