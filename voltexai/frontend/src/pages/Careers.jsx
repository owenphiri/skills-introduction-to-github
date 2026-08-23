// src/pages/Careers.jsx
import { useState } from "react";
import { CompanyPage, useCompany } from "../components/Company";
import { companyService } from "../services/company";
import { useAuth } from "../contexts/AuthContext";

export default function Careers() {
  const d = useCompany();
  const { user } = useAuth();
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [msg, setMsg] = useState("");

  const open = (role) => {
    setActive(role); setMsg("");
    setForm({ name: user?.full_name || "", email: user?.email || "", note: "" });
  };
  const submit = async (e) => {
    e.preventDefault(); setMsg("");
    try {
      const r = await companyService.apply({ role_id: active.id, ...form });
      setMsg(r.message || "Application received!");
    } catch { setMsg("Could not submit — check your details and try again."); }
  };

  return (
    <CompanyPage eyebrow="Join us" title="💼 Careers at VoltexAI"
      lead={d?.careers?.pitch}>
      {d && (
        <>
          <div className="vx-perk-row">
            {d.careers.perks.map((p) => <span key={p} className="vx-chip">{p}</span>)}
          </div>
          <div className="vx-role-list">
            {d.careers.roles.map((r) => (
              <div key={r.id} className="vx-role-row">
                <div>
                  <b>{r.title}</b>
                  <span className="vx-muted">{r.team} · {r.location} · {r.type}</span>
                </div>
                <button className="vx-btn-primary vx-btn-sm" onClick={() => open(r)}>Apply</button>
              </div>
            ))}
          </div>

          {active && (
            <div className="vx-modal-backdrop" onClick={() => setActive(null)}>
              <div className="vx-modal" onClick={(e) => e.stopPropagation()}>
                <button className="vx-modal-x" onClick={() => setActive(null)}>×</button>
                <h3>Apply — {active.title}</h3>
                <p className="vx-muted">{active.team} · {active.location}</p>
                {msg ? (
                  <div className="vx-rsvp-ok"><p>✅ {msg}</p>
                    <button className="vx-btn-primary vx-btn-sm" onClick={() => setActive(null)}>Done</button>
                  </div>
                ) : (
                  <form className="vx-rsvp-form" onSubmit={submit}>
                    <input required minLength={2} placeholder="Full name" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input required type="email" placeholder="Email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <textarea rows={3} maxLength={1000} placeholder="Why you? (optional)" value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })} />
                    <button className="vx-btn-primary">Submit application</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </CompanyPage>
  );
}
