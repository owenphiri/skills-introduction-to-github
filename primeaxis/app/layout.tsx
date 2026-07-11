import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = "https://primeaxis.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PrimeAxis Property Marketplace — Find. Buy. Rent. Invest.",
    template: "%s | PrimeAxis",
  },
  description:
    "PrimeAxis is the premium global property marketplace. Explore 50,000+ verified listings across 25 countries — luxury homes, apartments, land, and commercial real estate, backed by trusted agents and market analytics.",
  keywords: [
    "property marketplace",
    "real estate",
    "buy property",
    "rent property",
    "luxury homes",
    "commercial real estate",
    "land for sale",
    "property investment",
    "estate agents",
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "PrimeAxis Property Marketplace",
    title: "PrimeAxis — Find. Buy. Rent. Invest.",
    description:
      "The premium global property marketplace with 50,000+ verified listings across 25 countries.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrimeAxis — Find. Buy. Rent. Invest.",
    description:
      "The premium global property marketplace with 50,000+ verified listings across 25 countries.",
    creator: "@primeaxis",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  applicationName: "PrimeAxis",
  category: "Real Estate",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "PrimeAxis Property Marketplace",
      url: siteUrl,
      slogan: "Find. Buy. Rent. Invest.",
      logo: `${siteUrl}/icon.svg`,
      sameAs: [
        "https://www.linkedin.com/company/primeaxis",
        "https://www.facebook.com/primeaxis",
        "https://www.instagram.com/primeaxis",
        "https://www.youtube.com/@primeaxis",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "sales@primeaxis.example.com",
        availableLanguage: ["English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "PrimeAxis Property Marketplace",
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
