// src/i18n/index.jsx — lightweight i18n (no deps).
// Auto-detects the browser language, persists the choice, sets <html lang/dir>,
// and exposes a t() lookup with English fallback.
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { LOCALES, DICT as BASE_DICT } from "./locales";
import { PAGE_DICT } from "./pages";

// Merge shell + page dictionaries once per locale.
const DICT = Object.fromEntries(
  LOCALES.map((l) => [l.code, { ...(BASE_DICT[l.code] || {}), ...(PAGE_DICT[l.code] || {}) }])
);

const I18nContext = createContext(null);
const STORAGE_KEY = "vx-lang";
const SUPPORTED = LOCALES.map((l) => l.code);

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (e) { /* private mode */ }
  const langs = (navigator.languages || [navigator.language || "en"]);
  for (const l of langs) {
    const base = String(l).slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(base)) return base;
  }
  return "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitial);

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((l) => l.code === lang) || LOCALES[0];
    const root = document.documentElement;
    root.setAttribute("lang", meta.code);
    root.setAttribute("dir", meta.dir);
  }, [lang]);

  const t = useCallback((key) => {
    const table = DICT[lang] || DICT.en;
    return table[key] ?? DICT.en[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, locales: LOCALES }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  // Safe fallback so components never crash if used outside the provider.
  if (!ctx) return { lang: "en", setLang: () => {}, t: (k) => DICT.en[k] ?? k, locales: LOCALES };
  return ctx;
}
