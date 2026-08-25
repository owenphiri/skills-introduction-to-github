// src/components/ReferralCapture.jsx — capture ?ref=CODE once, store + count the click.
import { useEffect } from "react";
import { referralsService } from "../services/hub";

export function ReferralCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (!code) return;
      const key = "vx_ref";
      if (localStorage.getItem(key) !== code) {
        localStorage.setItem(key, code);
        referralsService.track(code).catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);
  return null;
}
