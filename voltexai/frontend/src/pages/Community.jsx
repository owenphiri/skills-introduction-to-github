// src/pages/Community.jsx — Voltex Community (global trader wall)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { useI18n } from "../i18n";
import { Footer } from "../components/Footer";
import { communityService } from "../services/hub";
import { KpiStrip } from "../components/Analytics";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function Community() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState({});

  const load = () => communityService.feed(30).then((r) => setPosts(r.posts)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      await communityService.post(body.trim());
      setBody("");
      load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const like = async (p) => {
    if (!p.real || liked[p.id]) return;
    setLiked((m) => ({ ...m, [p.id]: true }));
    setPosts((ps) => ps.map((x) => x.id === p.id ? { ...x, likes: x.likes + 1 } : x));
    try { await communityService.like(p.id); } catch { /* ignore */ }
  };

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>💬 Voltex Community</h1>
          <p className="vx-muted">{t("pg.community.sub")}</p>
        </div>

        <KpiStrip ids={["community", "products", "academy", "bullish"]} title="Community pulse" />

        {user ? (
          <form className="vx-post-box" onSubmit={submit}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              maxLength={500} rows={3}
              placeholder="Share a setup, a win, or a lesson with the community…" />
            <div className="vx-post-actions">
              <span className="vx-muted">{body.length}/500</span>
              <button className="vx-btn-primary vx-btn-sm" disabled={busy || body.trim().length < 2}>
                {busy ? "Posting…" : "Post to the wall"}
              </button>
            </div>
          </form>
        ) : (
          <div className="vx-post-cta">
            <p>Join the team to post on the global wall.</p>
            <Link to="/signup" className="vx-btn-primary vx-btn-sm">Get started free</Link>
          </div>
        )}

        <div className="vx-feed">
          {posts.map((p) => (
            <div key={p.id} className="vx-post">
              <div className="vx-post-head">
                <span className="vx-post-avatar">{p.flag}</span>
                <div>
                  <b>{p.author}</b>
                  <span className="vx-muted"> · {p.country}</span>
                </div>
              </div>
              <p className="vx-post-body">{p.body}</p>
              <button className={`vx-like ${liked[p.id] ? "on" : ""}`}
                onClick={() => like(p)} disabled={!p.real}>
                ❤ {p.likes}
              </button>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
