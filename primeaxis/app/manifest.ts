import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PrimeAxis Property Marketplace",
    short_name: "PrimeAxis",
    description:
      "The premium global property marketplace — find, buy, rent, and invest across 25 countries.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0F172A",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
