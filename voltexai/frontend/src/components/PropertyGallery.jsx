// src/components/PropertyGallery.jsx — procedural, brand-tinted property renderings.
// Not stock photography (honest placeholder): stylised SVG "views" tinted to the
// property's accent. Real photography replaces these at launch.
import { useState } from "react";

const VB = "0 0 400 260";

function Sky({ accent }) {
  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1220" />
          <stop offset="1" stopColor="#0a0e1a" />
        </linearGradient>
        <radialGradient id="glow" cx="0.8" cy="0.15" r="0.6">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="260" fill="url(#sky)" />
      <rect x="0" y="0" width="400" height="260" fill="url(#glow)" />
    </>
  );
}

// windows grid helper
function windows(x, y, cols, rows, cw, ch, gap, accent) {
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const lit = (r * 7 + c * 3) % 4 === 0;
      out.push(<rect key={`${r}-${c}`} x={x + c * (cw + gap)} y={y + r * (ch + gap)}
        width={cw} height={ch} rx="1"
        fill={lit ? accent : "#1f2a3d"} opacity={lit ? 0.85 : 0.6} />);
    }
  return out;
}

function Exterior({ accent, type }) {
  const office = /commercial|office/i.test(type);
  return (
    <svg viewBox={VB} className="vx-gal-svg" role="img" aria-label="Exterior rendering">
      <Sky accent={accent} />
      {/* neighbours */}
      <rect x="12" y="150" width="60" height="90" fill="#141c2b" />
      <rect x="330" y="140" width="58" height="100" fill="#141c2b" />
      {/* hero building */}
      <rect x="92" y={office ? 46 : 78} width="216" height={office ? 194 : 162} rx="4"
        fill="#17202f" stroke={accent} strokeOpacity="0.5" />
      <g>{windows(108, office ? 60 : 92, 7, office ? 9 : 7, 18, 12, 8, accent)}</g>
      {/* entrance */}
      <rect x="184" y="216" width="32" height="24" rx="2" fill={accent} opacity="0.85" />
      {/* ground */}
      <rect x="0" y="240" width="400" height="20" fill="#0b0f1a" />
      <line x1="0" y1="240" x2="400" y2="240" stroke={accent} strokeOpacity="0.35" />
    </svg>
  );
}

function Skyline({ accent }) {
  const bars = [[24, 170], [58, 120], [92, 150], [150, 70], [196, 110], [240, 40],
                [286, 130], [330, 90], [366, 150]];
  return (
    <svg viewBox={VB} className="vx-gal-svg" role="img" aria-label="Skyline rendering">
      <Sky accent={accent} />
      <circle cx="316" cy="52" r="26" fill={accent} opacity="0.22" />
      <circle cx="316" cy="52" r="14" fill={accent} opacity="0.5" />
      {bars.map(([x, h], i) => (
        <rect key={i} x={x} y={240 - h} width="30" height={h}
          fill={i === 5 ? "#17202f" : "#131b29"}
          stroke={i === 5 ? accent : "transparent"} strokeOpacity="0.6" />
      ))}
      {/* hero tower windows */}
      <g>{windows(246, 208, 3, 8, 6, 8, 5, accent)}</g>
      <rect x="0" y="240" width="400" height="20" fill="#0b0f1a" />
    </svg>
  );
}

function FloorPlan({ accent }) {
  const s = { fill: "none", stroke: accent, strokeOpacity: 0.7, strokeWidth: 2 };
  const lbl = { fill: "#8b97ac", fontSize: 9, fontFamily: "monospace" };
  return (
    <svg viewBox={VB} className="vx-gal-svg" role="img" aria-label="Floor plan">
      <rect x="0" y="0" width="400" height="260" fill="#0d1220" />
      <rect x="40" y="30" width="320" height="200" rx="3" {...s} />
      {/* internal walls */}
      <line x1="200" y1="30" x2="200" y2="150" {...s} />
      <line x1="40" y1="150" x2="360" y2="150" {...s} />
      <line x1="280" y1="30" x2="280" y2="150" {...s} />
      <line x1="130" y1="150" x2="130" y2="230" {...s} />
      <line x1="250" y1="150" x2="250" y2="230" {...s} />
      {/* door arcs */}
      <path d="M200 110 a22 22 0 0 1 22 22" {...s} strokeOpacity="0.4" />
      <text x="95" y="95" {...lbl}>LIVING</text>
      <text x="228" y="95" {...lbl}>BED 1</text>
      <text x="308" y="95" {...lbl}>BED 2</text>
      <text x="70" y="195" {...lbl}>KITCHEN</text>
      <text x="175" y="195" {...lbl}>BATH</text>
      <text x="290" y="195" {...lbl}>BALCONY</text>
    </svg>
  );
}

function LocationMap({ accent, city }) {
  return (
    <svg viewBox={VB} className="vx-gal-svg" role="img" aria-label={`Map of ${city}`}>
      <rect x="0" y="0" width="400" height="260" fill="#0d1220" />
      {/* streets */}
      {[60, 130, 200].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1f2a3d" strokeWidth="6" />)}
      {[80, 200, 320].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="260" stroke="#1f2a3d" strokeWidth="6" />)}
      {/* blocks */}
      {[[24, 74, 44, 44], [212, 20, 96, 30], [92, 142, 96, 46], [332, 150, 50, 90]].map(([x, y, w, h], i) =>
        <rect key={i} x={x} y={y} width={w} height={h} rx="2" fill="#141c2b" />)}
      {/* pin */}
      <g transform="translate(200 118)">
        <path d="M0 34 C -18 8 -14 -14 0 -14 C 14 -14 18 8 0 34 Z" fill={accent} />
        <circle cx="0" cy="-2" r="7" fill="#0a0e1a" />
      </g>
      <text x="212" y="132" fill="#e6ecf3" fontSize="11" fontFamily="monospace">{city}</text>
      <text x="360" y="30" fill={accent} fontSize="12" fontFamily="monospace">N↑</text>
    </svg>
  );
}

export function PropertyGallery({ p }) {
  const views = [
    { key: "exterior", label: "Exterior", el: <Exterior accent={p.accent} type={p.type} /> },
    { key: "skyline", label: "Skyline", el: <Skyline accent={p.accent} /> },
    { key: "floor", label: "Floor plan", el: <FloorPlan accent={p.accent} /> },
    { key: "location", label: "Location", el: <LocationMap accent={p.accent} city={p.city} /> },
  ];
  const [active, setActive] = useState(0);

  return (
    <div className="vx-gal">
      <div className="vx-gal-main">
        {views[active].el}
        <span className="vx-gal-view">{views[active].label}</span>
        <span className="vx-gal-note">Illustrative rendering · real photography at launch</span>
      </div>
      <div className="vx-gal-thumbs" role="tablist" aria-label="Property views">
        {views.map((v, i) => (
          <button key={v.key} role="tab" aria-selected={i === active}
            className={`vx-gal-thumb ${i === active ? "active" : ""}`} onClick={() => setActive(i)}>
            <div className="vx-gal-thumb-svg">{v.el}</div>
            <span>{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
