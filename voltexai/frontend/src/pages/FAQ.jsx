// src/pages/FAQ.jsx
import { useState } from "react";
import { CompanyPage, useCompany } from "../components/Company";

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`vx-faq-item ${open ? "open" : ""}`}>
      <button className="vx-faq-q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span><span className="vx-faq-caret">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="vx-faq-a">{a}</p>}
    </div>
  );
}

export default function FAQ() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Help" title="❓ Frequently Asked Questions"
      lead="Everything you need to know about VoltexAI.">
      {d && (
        <div className="vx-faq-list">
          {d.faq.map((f, i) => <Item key={i} q={f.q} a={f.a} />)}
        </div>
      )}
    </CompanyPage>
  );
}
