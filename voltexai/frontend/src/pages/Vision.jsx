// src/pages/Vision.jsx — Voltex Vision (chart / image analysis)
import { useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { aiService } from "../services/ai";
import { useAuth } from "../contexts/AuthContext";

export default function Vision() {
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [mediaType, setMediaType] = useState("image/png");
  const [pair, setPair] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(""); setResult("");
    setMediaType(f.type || "image/png");
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      setB64(String(reader.result).split(",")[1]);
    };
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!b64) return;
    setBusy(true); setErr(""); setResult("");
    try {
      const r = await aiService.analyzeChart({
        image_b64: b64, media_type: mediaType,
        instruction: "Run the standard VoltexAI analysis on this chart.",
        pair: pair || undefined,
      });
      setResult(r.reply);
    } catch (e) {
      setErr(e.status === 401 ? "Log in to analyze charts."
        : e.status === 402 ? "Chart Vision needs a Trader or Elite plan."
        : (e.message || "Analysis failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container vx-narrow">
        <div className="vx-page-head">
          <h1>👁️ Voltex Vision</h1>
          <p className="vx-muted">
            Upload any chart screenshot. Vision reads structure, liquidity, order blocks
            and key levels — then writes the full trade plan.
          </p>
        </div>

        <div className="vx-vision-card">
          <label className="vx-vision-drop">
            <input type="file" accept="image/*" onChange={onFile} hidden />
            {preview
              ? <img src={preview} alt="chart" className="vx-vision-preview" />
              : <div className="vx-vision-placeholder"><span>📈</span><b>Click to upload a chart</b><small>PNG / JPG</small></div>}
          </label>
          <div className="vx-form-row">
            <input placeholder="Pair (optional, e.g. XAUUSD)" value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())} />
            {user ? (
              <button className="vx-btn-primary" onClick={analyze} disabled={!b64 || busy}>
                {busy ? "Analyzing…" : "Analyze chart"}
              </button>
            ) : (
              <Link to="/login" className="vx-btn-primary">Log in to analyze</Link>
            )}
          </div>
          {err && <div className="vx-banner vx-banner--warn">{err}</div>}
          {result && (
            <div className="vx-vision-result">
              <h3>VoltexAI reads this chart:</h3>
              <div className="vx-vision-text">{result}</div>
            </div>
          )}
        </div>
        <p className="vx-fineprint">
          AI analysis is educational, not financial advice or a guaranteed outcome.
        </p>
      </main>
      <Footer />
    </div>
  );
}
