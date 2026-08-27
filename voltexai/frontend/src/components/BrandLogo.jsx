// src/components/BrandLogo.jsx — renders the active tenant's logo/name.
// The flagship VoltexAI keeps its exact "Voltex + AI" styling; other tenants get
// their emoji/logo + name so the app is genuinely white-labelled.
import { useBrand } from "../contexts/BrandContext";

export function BrandLogo() {
  const brand = useBrand();
  if (brand.slug === "voltexai") {
    return (
      <>
        <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
      </>
    );
  }
  return (
    <>
      {brand.logo_url
        ? <img src={brand.logo_url} alt="" className="vx-logo-img" />
        : <span className="vx-logo-mark">{brand.logo_emoji || "⚡"}</span>}
      {" "}{brand.name}
    </>
  );
}
