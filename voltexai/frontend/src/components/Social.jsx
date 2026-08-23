// src/components/Social.jsx — brand social icons (X, Telegram, Facebook, WhatsApp)
// Handles are centralised here and mirror the backend catalog (/api/dashboard).

export const SOCIALS = [
  { id: "x", label: "X", url: "https://x.com/VoltexAI" },
  { id: "telegram", label: "Telegram", url: "https://t.me/VoltexAI" },
  { id: "facebook", label: "Facebook", url: "https://facebook.com/VoltexAI" },
  { id: "whatsapp", label: "WhatsApp", url: "https://wa.me/260970000000" },
];

const PATHS = {
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  telegram: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z",
  facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  whatsapp: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 005.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.945a11.821 11.821 0 00-3.48-8.418z",
};

export function SocialIcon({ id, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={PATHS[id]} />
    </svg>
  );
}

// Inline row of labelled/plain icons (footer, page headers)
export function SocialBar({ compact = false }) {
  return (
    <div className={`vx-social-bar ${compact ? "compact" : ""}`}>
      {SOCIALS.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
           className={`vx-social-link vx-social--${s.id}`} aria-label={s.label} title={s.label}>
          <SocialIcon id={s.id} />
          {!compact && <span>{s.label}</span>}
        </a>
      ))}
    </div>
  );
}

// Slim fixed vertical rail of icons, mounted globally (all pages)
export function SocialRail() {
  return (
    <div className="vx-social-rail" aria-label="VoltexAI on social media">
      {SOCIALS.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
           className={`vx-rail-icon vx-social--${s.id}`} aria-label={s.label} title={s.label}>
          <SocialIcon id={s.id} size={18} />
        </a>
      ))}
    </div>
  );
}
