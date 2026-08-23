// src/pages/Store.jsx — Voltex Store
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { storeService } from "../services/ecosystem";

const CATS = [["all", "All"], ["plans", "Plans"], ["education", "Education"],
              ["tools", "Tools"], ["merch", "Merch"]];

export default function Store() {
  const [cat, setCat] = useState("all");
  const [items, setItems] = useState([]);

  useEffect(() => { storeService.list(cat).then((d) => setItems(d.products)).catch(() => {}); }, [cat]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛍️ Voltex Store</h1>
          <p className="vx-muted">Plans, education, trading tools and merch — checkout with Voltex Pay.</p>
        </div>
        <div className="vx-class-tabs">
          {CATS.map(([id, label]) => (
            <button key={id} className={cat === id ? "active" : ""} onClick={() => setCat(id)}>{label}</button>
          ))}
        </div>
        <div className="vx-card-grid">
          {items.map((p) => (
            <div key={p.id} className="vx-store-card vx-rise">
              {p.badge && <span className="vx-store-badge">{p.badge}</span>}
              <div className="vx-store-icon">{p.icon}</div>
              <h3>{p.name}</h3>
              <p className="vx-muted vx-store-desc">{p.desc}</p>
              <ul className="vx-store-features">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <div className="vx-store-foot">
                <span className="vx-store-price">
                  ${p.price_usd}{p.period !== "once" && <small>/{p.period}</small>}
                </span>
                <Link to={p.category === "plans" ? "/pricing" : "/pay"} className="vx-btn-primary vx-btn-sm">
                  {p.category === "plans" ? "Choose" : "Buy"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
