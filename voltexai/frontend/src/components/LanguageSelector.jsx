// src/components/LanguageSelector.jsx — globe dropdown to switch UI language
import { useI18n } from "../i18n";

export function LanguageSelector({ compact = false }) {
  const { lang, setLang, t, locales } = useI18n();
  return (
    <label className={`vx-lang ${compact ? "compact" : ""}`} title={t("common.language")}>
      <span className="vx-lang-globe" aria-hidden="true">🌐</span>
      <span className="vx-sr-only">{t("common.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("common.language")}>
        {locales.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}
