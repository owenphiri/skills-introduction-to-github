// src/pages/Kyc.jsx — identity verification (KYC) submission + status
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { kycService } from "../services/kyc";

const STATUS_COPY = {
  none: { label: "Not started", cls: "sim", msg: "Verify your identity to unlock live-money trading." },
  pending: { label: "Under review", cls: "warn", msg: "We've received your details — review usually takes 1 business day." },
  approved: { label: "Verified", cls: "ok", msg: "You're fully verified. Live trading is unlocked." },
  rejected: { label: "Rejected", cls: "warn", msg: "We couldn't verify your details. Please review and resubmit." },
};

export default function Kyc() {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    full_legal_name: "", date_of_birth: "", country: "",
    document_type: "national_id", document_number: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => kycService.status().then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await kycService.submit(form);
      await load();
    } catch (e2) {
      setErr(e2.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  const s = status?.status || "none";
  const copy = STATUS_COPY[s] || STATUS_COPY.none;
  const locked = s === "approved" || s === "pending";

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container vx-narrow">
        <div className="vx-page-head">
          <h1>Identity Verification</h1>
          <p className="vx-muted">
            KYC keeps the platform compliant and unlocks live-money trading. Your paper
            account works without it. We never store raw ID images in the app.
          </p>
        </div>

        <div className={`vx-recon-status ${copy.cls === "ok" ? "ok" : "warn"}`}>
          <span><b>Status:</b> {copy.label} — {copy.msg}</span>
        </div>
        {status?.reject_reason && <p className="vx-down">Reason: {status.reject_reason}</p>}

        {!locked && (
          <form className="vx-enquiry-form" onSubmit={submit}>
            <div className="vx-form-row">
              <input required placeholder="Full legal name" value={form.full_legal_name}
                onChange={(e) => setForm({ ...form, full_legal_name: e.target.value })} />
              <input type="date" placeholder="Date of birth" value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="vx-form-row">
              <input placeholder="Country" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <select value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}>
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's license</option>
              </select>
              <input placeholder="Document number" value={form.document_number}
                onChange={(e) => setForm({ ...form, document_number: e.target.value })} />
            </div>
            <button className="vx-btn-primary" type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit for verification"}
            </button>
            {err && <p className="vx-banner vx-banner--warn">{err}</p>}
          </form>
        )}
        <p className="vx-fineprint">
          Verification is handled by VoltexAI / PrimeAxis ICT. Live managed programs and
          live-money trading may require approval; paper trading is always available.
        </p>
      </main>
    </div>
  );
}
