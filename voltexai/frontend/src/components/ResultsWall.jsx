// src/components/ResultsWall.jsx — global "how clients are killing the markets" wall
import { useEffect, useState } from "react";
import { resultsService } from "../services/results";

const MARKETS = ["all", "forex", "metals", "indices", "crypto", "synthetics", "futures", "stocks"];
const EMPTY = { body: "", symbol: "", market: "", timeframe: "", pnl_pct: "", image_url: "" };

function pnlLabel(p) {
  if (p.pnl_pct != null) return `+${p.pnl_pct}%`;
  if (p.pnl_amount != null) return `+${p.pnl_amount} ${p.currency || ""}`.trim();
  return null;
}

export function ResultsWall() {
  const [market, setMarket] = useState("all");
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () =>
    resultsService.feed({ market: market === "all" ? "" : market })
      .then((d) => setPosts(d.posts || [])).catch(() => {});

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [market]);

  const submit = (e) => {
    e.preventDefault();
    if (form.body.trim().length < 4) { setMsg("Tell us a little more about the trade."); return; }
    setBusy(true); setMsg("");
    const payload = {
      body: form.body.trim(),
      symbol: form.symbol.trim().toUpperCase() || null,
      market: form.market || null,
      timeframe: form.timeframe.trim().toUpperCase() || null,
      pnl_pct: form.pnl_pct === "" ? null : Number(form.pnl_pct),
      image_url: form.image_url.trim() || null,
    };
    resultsService.post(payload)
      .then(() => { setForm(EMPTY); setOpen(false); setMsg("Posted — thanks for sharing your win! 🎉"); return load(); })
      .catch((err) => setMsg(err.status === 401 || err.status === 403
        ? "Sign in to post your result."
        : (err.message || "Could not post right now.")))
      .finally(() => setBusy(false));
  };

  const like = (id) => {
    if (typeof id !== "number") return;
    resultsService.like(id).then((r) =>
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: r.likes } : p)))).catch(() => {});
  };

  return (
    <section className="vx-panel vx-results">
      <div className="vx-results-head">
        <div>
          <span className="vx-eyebrow">Results · Live from the community</span>
          <h3>How traders are killing the markets with VoltexAI 🌍</h3>
        </div>
        <button className="vx-btn-primary vx-btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "＋ Share your win"}
        </button>
      </div>

      {open && (
        <form className="vx-results-form" onSubmit={submit}>
          <textarea className="vx-input" rows={3} maxLength={600} placeholder="How did VoltexAI help you win? Tell your story…"
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="vx-results-form-row">
            <input className="vx-input" placeholder="Symbol (e.g. XAUUSD)" value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
            <select className="vx-input" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })}>
              <option value="">Market…</option>
              {MARKETS.filter((m) => m !== "all").map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="vx-input" placeholder="TF (M15)" value={form.timeframe}
              onChange={(e) => setForm({ ...form, timeframe: e.target.value })} />
            <input className="vx-input" type="number" step="0.1" placeholder="Gain %" value={form.pnl_pct}
              onChange={(e) => setForm({ ...form, pnl_pct: e.target.value })} />
          </div>
          <input className="vx-input" placeholder="Screenshot URL (optional, https://…)" value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <div className="vx-results-form-foot">
            <small className="vx-muted">Be honest — results vary and trading involves risk. Posts are reviewed before the ✓ verified badge.</small>
            <button className="vx-btn-primary vx-btn-sm" disabled={busy}>{busy ? "Posting…" : "Post result"}</button>
          </div>
        </form>
      )}
      {msg && <p className="vx-results-msg">{msg}</p>}

      <div className="vx-class-tabs vx-results-tabs">
        {MARKETS.map((m) => (
          <button key={m} className={m === market ? "active" : ""} onClick={() => setMarket(m)}>{m}</button>
        ))}
      </div>

      <div className="vx-results-grid">
        {posts.map((p) => {
          const pnl = pnlLabel(p);
          return (
            <article key={p.id} className="vx-result-card">
              <div className="vx-result-top">
                <span className="vx-result-who"><span className="vx-flag">{p.flag}</span> {p.author}
                  <small className="vx-muted"> · {p.country}</small></span>
                {p.verified && <span className="vx-result-verified">✓ Verified</span>}
              </div>
              {p.image_url && (
                <a href={p.image_url} target="_blank" rel="noopener noreferrer" className="vx-result-shot">
                  <img src={p.image_url} alt={`${p.symbol || "trade"} result`} loading="lazy" />
                </a>
              )}
              <p className="vx-result-body">{p.body}</p>
              <div className="vx-result-meta">
                {p.symbol && <span className="vx-chip">{p.symbol}</span>}
                {p.market && <span className="vx-chip">{p.market}</span>}
                {p.timeframe && <span className="vx-chip">{p.timeframe}</span>}
                {pnl && <span className="vx-result-pnl">{pnl}</span>}
              </div>
              <button className="vx-result-like" onClick={() => like(p.id)} disabled={typeof p.id !== "number"}>
                ♥ {p.likes || 0}
              </button>
            </article>
          );
        })}
      </div>
      <p className="vx-fineprint">Client-submitted results. Not a performance guarantee — trading involves risk of loss.</p>
    </section>
  );
}
