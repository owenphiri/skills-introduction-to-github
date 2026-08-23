// src/components/VMarquee.jsx — vertical scrolling marquee (up or down)
// Content is duplicated so the CSS loop is seamless. `dir` = "up" | "down".

export function VMarquee({ items = [], dir = "up", render, title, className = "" }) {
  if (!items.length) return null;
  const loop = [...items, ...items];
  return (
    <div className={`vx-vmarquee ${className}`}>
      {title && <div className="vx-vmarquee-title">{title}</div>}
      <div className="vx-vmarquee-viewport">
        <div className={`vx-vmarquee-track ${dir === "down" ? "down" : "up"}`}>
          {loop.map((it, i) => (
            <div key={i} className="vx-vmarquee-item">{render(it)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
