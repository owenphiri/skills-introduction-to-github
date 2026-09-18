// src/components/GlobeMap.jsx — 3D global trading-sessions map (SVG orthographic globe)
import { useEffect, useRef, useState } from "react";

const R = 168;          // globe radius
const CX = 220, CY = 220;
const rad = (d) => (d * Math.PI) / 180;
const LAT0 = 16;        // camera tilt (deg) — a pleasing 3/4 view

// Orthographic projection of (lat,lon) onto the globe disc, rotated by lon0.
function project(lat, lon, lon0) {
  const phi = rad(lat), lam = rad(lon - lon0), phi0 = rad(LAT0);
  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  const x = R * Math.cos(phi) * Math.sin(lam);
  const y = R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam));
  return { x: CX + x, y: CY - y, visible: cosc >= -0.02, depth: cosc };
}

function graticule(lon0) {
  const paths = [];
  for (let lon = -150; lon <= 180; lon += 30) {       // meridians
    let d = "", pen = false;
    for (let lat = -80; lat <= 80; lat += 4) {
      const p = project(lat, lon, lon0);
      if (p.visible) { d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; pen = true; }
      else pen = false;
    }
    if (d) paths.push(d);
  }
  for (let lat = -60; lat <= 60; lat += 30) {          // parallels
    let d = "", pen = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = project(lat, lon, lon0);
      if (p.visible) { d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; pen = true; }
      else pen = false;
    }
    if (d) paths.push(d);
  }
  return paths;
}

function fmt(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`; }

export function GlobeMap({ data }) {
  const [lon0, setLon0] = useState(20);
  const raf = useRef();

  useEffect(() => {
    let last = performance.now();
    const tick = (t) => {
      const dt = t - last; last = t;
      setLon0((v) => (v + dt * 0.006) % 360);   // ~ one rotation / minute
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  if (!data?.hubs) return null;
  const byId = Object.fromEntries(data.hubs.map((h) => [h.id, h]));
  const proj = Object.fromEntries(data.hubs.map((h) => [h.id, project(h.lat, h.lon, lon0)]));
  const grat = graticule(lon0);

  return (
    <section className="vx-globe">
      <div className="vx-globe-head">
        <div>
          <span className="vx-eyebrow">🌍 Global Trading Sessions</span>
          <h2 className="vx-section-title" style={{ margin: "4px 0 0" }}>The market never sleeps</h2>
        </div>
        <div className="vx-globe-stat">
          <span className="vx-live-badge">● {fmt(data.total_participants)} live</span>
          <small className="vx-muted">{data.open_sessions?.length
            ? `${data.open_sessions.join(" · ")} open` : "Between sessions"} · {data.utc_time}</small>
        </div>
      </div>

      <div className="vx-globe-wrap">
        <svg viewBox="0 0 440 440" className="vx-globe-svg" role="img"
          aria-label="3D globe of live trading sessions">
          <defs>
            <radialGradient id="vxOcean" cx="38%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#173056" />
              <stop offset="55%" stopColor="#0e1c34" />
              <stop offset="100%" stopColor="#070d18" />
            </radialGradient>
            <filter id="vxGlow"><feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          <circle cx={CX} cy={CY} r={R} fill="url(#vxOcean)"
            stroke="rgba(120,160,220,0.35)" strokeWidth="1" />
          {grat.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(120,160,220,0.16)" strokeWidth="0.8" />
          ))}

          {/* flow arcs (session handoffs) */}
          {data.flows.map((f, i) => {
            const a = proj[f.from], b = proj[f.to];
            if (!a || !b || !a.visible || !b.visible) return null;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const nx = mx - CX, ny = my - CY;
            const len = Math.hypot(nx, ny) || 1;
            const bow = 0.28 * Math.hypot(b.x - a.x, b.y - a.y);
            const ctrlX = mx + (nx / len) * bow, ctrlY = my + (ny / len) * bow;
            const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
            return <path key={i} d={d} className={`vx-globe-arc ${f.active ? "active" : ""}`} fill="none" />;
          })}

          {/* hubs */}
          {data.hubs.map((h) => {
            const p = proj[h.id];
            if (!p.visible) return null;
            const r = Math.max(3, Math.min(11, Math.sqrt(h.participants) / 6));
            const cls = h.home ? "home" : h.open ? "open" : "closed";
            const showLabel = h.open || h.home || h.participants > 1200;
            return (
              <g key={h.id} className={`vx-globe-hub ${cls}`} filter={h.open || h.home ? "url(#vxGlow)" : undefined}>
                {(h.open || h.home) && <circle cx={p.x} cy={p.y} r={r + 5} className="vx-globe-pulse" />}
                <circle cx={p.x} cy={p.y} r={r} className="vx-globe-dot" />
                {showLabel && (
                  <text x={p.x + r + 4} y={p.y + 3} className="vx-globe-label">
                    {h.flag} {h.city} · {fmt(h.participants)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="vx-globe-legend">
        <span><i className="vx-lg open" /> Session open</span>
        <span><i className="vx-lg closed" /> Closed</span>
        <span><i className="vx-lg home" /> VoltexAI desk · Lusaka</span>
        <span className="vx-muted">Arrows = live session handoff · dot size = active traders</span>
      </div>
      <p className="vx-fineprint">Live participant counts are indicative. Session times exclude DST.</p>
    </section>
  );
}
