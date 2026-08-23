// src/pages/Travel.jsx — Voltex Travel (summits, meetups & retreats)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { travelService } from "../services/hub";
import { KpiStrip } from "../components/Analytics";
import { useAuth } from "../contexts/AuthContext";

const TYPES = ["all", "Summit", "Meetup", "Retreat"];

export default function Travel() {
  const { user } = useAuth();
  const [type, setType] = useState("all");
  const [events, setEvents] = useState([]);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", country: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    travelService.list(type).then((r) => setEvents(r.events)).catch(() => {});
  }, [type]);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: user.full_name || f.name, email: user.email || f.email }));
  }, [user]);

  const rsvp = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const r = await travelService.rsvp(active.id, form);
      setMsg(r.message || "You're on the list!");
    } catch { setMsg("Could not RSVP — check your details and try again."); }
  };

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>✈️ Voltex Travel</h1>
          <p className="vx-muted">
            Meet the community IRL — summits, meetups and retreats from Lusaka
            to Dubai. Trade, learn, network, explore.
          </p>
        </div>

        <KpiStrip ids={["community", "products", "academy", "sessions"]} title="Community pulse" />

        <div className="vx-filter-row">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`vx-filter-chip ${type === t ? "active" : ""}`}>{t}</button>
          ))}
        </div>

        <div className="vx-travel-grid">
          {events.map((ev) => (
            <div key={ev.id} className="vx-travel-card">
              <div className="vx-travel-banner">
                <span className="vx-travel-flag">{ev.flag}</span>
                <span className="vx-chip">{ev.type}</span>
              </div>
              <h3>{ev.title}</h3>
              <p className="vx-travel-where">📍 {ev.city}, {ev.country} · {ev.month}</p>
              <p className="vx-muted">{ev.desc}</p>
              <div className="vx-travel-foot">
                <span className="vx-travel-price">{ev.price_usd === 0 ? "Free" : `$${ev.price_usd}`}</span>
                <span className="vx-muted">{ev.spots} spots</span>
                <button className="vx-btn-primary vx-btn-sm"
                  onClick={() => { setActive(ev); setMsg(""); }}>RSVP</button>
              </div>
            </div>
          ))}
        </div>

        {active && (
          <div className="vx-modal-backdrop" onClick={() => setActive(null)}>
            <div className="vx-modal" onClick={(e) => e.stopPropagation()}>
              <button className="vx-modal-x" onClick={() => setActive(null)}>×</button>
              <h3>RSVP — {active.title}</h3>
              <p className="vx-muted">{active.city}, {active.country} · {active.month}</p>
              {msg ? (
                <div className="vx-rsvp-ok">
                  <p>✅ {msg}</p>
                  <button className="vx-btn-primary vx-btn-sm" onClick={() => setActive(null)}>Done</button>
                </div>
              ) : (
                <form className="vx-rsvp-form" onSubmit={rsvp}>
                  <input required minLength={2} placeholder="Full name"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input required type="email" placeholder="Email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input placeholder="Country (optional)"
                    value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  <button className="vx-btn-primary">Reserve my spot</button>
                </form>
              )}
            </div>
          </div>
        )}
        <p className="vx-fineprint">RSVPs reserve interest; final dates, venues and pricing are confirmed by email.</p>
      </main>
      <Footer />
    </div>
  );
}
