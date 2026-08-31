// src/components/Discussion.jsx — VoltexAI share bar + community discussion
// Same layout as a classic share+comments block, restyled in the voltaic dark theme.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SocialIcon } from "./Social";
import { useAuth } from "../contexts/AuthContext";
import { communityService } from "../services/hub";

// extra glyphs not in Social.jsx (kept local to this component)
const GLYPH = {
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  reddit: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 13.402c.02.14.03.28.03.42 0 2.15-2.5 3.89-5.59 3.89s-5.59-1.74-5.59-3.89c0-.14.01-.28.03-.42a1.37 1.37 0 01-.79-1.24c0-.76.62-1.37 1.38-1.37.37 0 .7.15.95.38 1.02-.66 2.42-1.09 3.98-1.14l.77-2.43a.24.24 0 01.28-.16l2.02.47c.16-.38.53-.65.96-.65.58 0 1.05.47 1.05 1.05s-.47 1.05-1.05 1.05c-.56 0-1.02-.44-1.05-1l-1.8-.42-.69 2.17c1.53.06 2.91.49 3.92 1.14.25-.23.58-.37.94-.37.76 0 1.38.61 1.38 1.37 0 .53-.31.99-.75 1.21zm-6.66-.86c-.51 0-.92.41-.92.92s.41.92.92.92.92-.41.92-.92-.41-.92-.92-.92zm3.3 0c-.51 0-.92.41-.92.92s.41.92.92.92.92-.41.92-.92-.41-.92-.92-.92zm-.15 2.71c-.5.5-1.29.74-2.5.74s-2-.24-2.5-.74a.26.26 0 00-.37.37c.62.62 1.55.9 2.87.9s2.25-.28 2.87-.9a.26.26 0 00-.37-.37z",
  email: "M0 3v18h24V3H0zm21.518 2L12 12.713 2.482 5h19.036zM2 19V6.183l10 8.104 10-8.104V19H2z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  bookmark: "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z",
};

function Glyph({ d, size = 18 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
}

function ago(iso) {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "";        // seed/sample posts carry no timestamp
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function Discussion({ title = "VoltexAI — Africa's AI trading terminal", topic }) {
  const { user } = useAuth();
  const url = typeof window !== "undefined" ? window.location.origin : "https://voltexai.vercel.app";
  const enc = encodeURIComponent, U = enc(url), T = enc(title);

  const SHARE = [
    { id: "x", href: `https://twitter.com/intent/tweet?text=${T}&url=${U}` },
    { id: "linkedin", d: GLYPH.linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${U}` },
    { id: "telegram", href: `https://t.me/share/url?url=${U}&text=${T}` },
    { id: "whatsapp", href: `https://wa.me/?text=${T}%20${U}` },
    { id: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${U}` },
    { id: "reddit", d: GLYPH.reddit, href: `https://www.reddit.com/submit?url=${U}&title=${T}` },
    { id: "email", d: GLYPH.email, href: `mailto:?subject=${T}&body=${U}` },
  ];

  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    try { setSaved(localStorage.getItem("vx_dash_saved") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleSave = () => {
    const next = !saved; setSaved(next);
    try { localStorage.setItem("vx_dash_saved", next ? "1" : "0"); } catch { /* ignore */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };

  // ---- discussion ----
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => communityService.feed(20, topic).then((d) => setPosts(d.posts || d || [])).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [topic]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try { await communityService.post(body.trim(), topic); setBody(""); await load(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };
  const like = async (p) => {
    if (p.real === false) return;   // seed/sample posts aren't likeable
    try { await communityService.like(p.id); await load(); } catch { /* ignore */ }
  };

  return (
    <div className="vx-discuss">
      {/* Share + save row */}
      <div className="vx-share-bar">
        {SHARE.map((s) => (
          <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer"
             className={`vx-share-icon vx-social--${s.id}`} aria-label={`Share on ${s.id}`} title={`Share on ${s.id}`}>
            {s.d ? <Glyph d={s.d} /> : <SocialIcon id={s.id} size={18} />}
          </a>
        ))}
        <button className="vx-share-icon vx-share--link" onClick={copy} title="Copy link">
          <Glyph d={GLYPH.link} />
        </button>
        <button className={`vx-share-icon vx-share--save ${saved ? "on" : ""}`} onClick={toggleSave}
                title={saved ? "Saved" : "Save"}>
          <Glyph d={GLYPH.bookmark} />
        </button>
        {copied && <span className="vx-share-copied">Link copied ✓</span>}
      </div>

      {/* Discussion */}
      <div className="vx-discuss-head">
        <h3>{posts.length} {posts.length === 1 ? "Comment" : "Comments"}</h3>
        <span className="vx-discuss-sort">Newest ▾</span>
      </div>

      {user ? (
        <form className="vx-discuss-composer" onSubmit={submit}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder="Start the discussion…" rows={3} maxLength={2000} />
          <div className="vx-discuss-actions">
            <span className="vx-muted">{2000 - body.length} left</span>
            <button className="vx-btn-primary vx-btn-sm" disabled={!body.trim() || busy}>
              {busy ? "Posting…" : "Share"}
            </button>
          </div>
        </form>
      ) : (
        <div className="vx-discuss-login">
          <p className="vx-muted">Join the discussion with the VoltexAI community.</p>
          <div className="vx-discuss-login-btns">
            <Link to="/login" className="vx-btn-secondary vx-btn-sm">Log in</Link>
            <Link to="/signup" className="vx-btn-primary vx-btn-sm">Sign up</Link>
          </div>
        </div>
      )}

      <div className="vx-discuss-list">
        {posts.length === 0 && <p className="vx-muted">Be the first to start the discussion.</p>}
        {posts.map((p) => (
          <div key={p.id} className="vx-comment">
            <div className="vx-comment-avatar">{(p.author || "?").charAt(0).toUpperCase()}</div>
            <div className="vx-comment-body">
              <div className="vx-comment-meta">
                <b>{p.author}</b>
                {p.country && <span className="vx-muted"> · {p.country}</span>}
                {ago(p.created_at) && <span className="vx-muted"> · {ago(p.created_at)}</span>}
              </div>
              <p>{p.body}</p>
              <button className="vx-comment-like" onClick={() => like(p)}>♥ {p.likes || 0}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
