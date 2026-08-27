// src/contexts/BrandContext.jsx — white-label branding, resolved at runtime.
// Derives the tenant slug from the hostname (a `<slug>.base` subdomain) or a
// ?tenant= override, fetches its brand, applies the accent colour + document
// title, and exposes it via useBrand(). Falls back to VoltexAI defaults so the
// app always renders even if the API is unreachable.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const DEFAULT_BRAND = {
  slug: "voltexai",
  name: "VoltexAI",
  tagline: "The operating system for the African trader.",
  motto: "Trade Smart · Trade Safe · Trade Consistently",
  accent_color: "#C2F53D",
  logo_emoji: "⚡",
  powered_by: "Powered by Axion Labs Technologies",
  ceo: "OP OWENS PHIRI",
  established: "EST. 2017",
  socials: [],
};

const BrandContext = createContext(DEFAULT_BRAND);

function detectSlug() {
  try {
    const q = new URLSearchParams(window.location.search).get("tenant");
    if (q) return q.toLowerCase();
    const host = window.location.hostname.toLowerCase();
    const parts = host.split(".");
    if (parts.length >= 3 && !["www", "app", "api"].includes(parts[0])) {
      return parts[0];
    }
  } catch (e) { /* ignore */ }
  return null;
}

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  useEffect(() => {
    const slug = detectSlug();
    const path = slug ? `/api/tenant?tenant=${encodeURIComponent(slug)}` : "/api/tenant";
    api.get(path)
      .then((b) => { if (b && b.name) setBrand({ ...DEFAULT_BRAND, ...b }); })
      .catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (brand.accent_color) {
        root.style.setProperty("--vx-accent", brand.accent_color);
      }
      if (brand.name && brand.slug !== "voltexai") {
        document.title = brand.name;
      }
    } catch (e) { /* ignore */ }
  }, [brand]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
