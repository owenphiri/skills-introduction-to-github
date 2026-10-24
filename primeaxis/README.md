# PrimeAxis Property Marketplace

**Find. Buy. Rent. Invest.**

A production-ready, premium property-marketplace landing page built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Framer Motion. Designed to compete with Zillow, Realtor.com, Property24, and Airbnb on polish, performance, and conversion.

## ✨ Highlights

- **Hero with live search** — Buy / Rent / Commercial / Land / Luxury tabs, location, property-type, price, beds, baths, and country filters, plus floating animated stat cards (50,000+ properties, 12,000+ agents, 25 countries, 1M monthly visitors).
- **Featured properties** — filterable card grid with badges (Featured / New / Verified), save, compare, share, virtual-tour, and contact-agent actions.
- **Investment calculators** — interactive Mortgage/EMI, ROI, Rental Yield, and Appreciation calculators with live sliders.
- **Neighbourhood map** — stylised interactive-map preview (Google Maps drops in with one API key) with nearby schools, hospitals, restaurants, malls, fuel stations, and transport.
- **Full marketing stack** — animated stats, 10 property categories, 12 services, why-choose-us, testimonial carousel, partner developers, news/insights, 3-tier agent pricing, newsletter capture, and a validated lead-capture consultation form.
- **Dark / light mode** — class-based theming via `next-themes` with system preference support.
- **SEO** — complete metadata, Open Graph, Twitter Cards, Schema.org JSON-LD (Organization, WebSite + SearchAction, BreadcrumbList), canonical URL, `sitemap.xml`, `robots.txt`.
- **PWA-ready** — web app manifest + SVG icon.
- **Accessibility (WCAG AA)** — skip link, semantic landmarks, proper heading hierarchy, ARIA labels/roles on all interactive widgets, visible focus rings, `prefers-reduced-motion` support, form errors announced via `role="alert"`.
- **Forms** — React Hook Form + Zod validation, success animation, Sonner toasts, honeypot spam protection, CAPTCHA-ready.

## 🧱 Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui-style primitives (cva) |
| Animation | Framer Motion (+ reduced-motion support) |
| Icons | Lucide |
| Forms | React Hook Form + Zod + @hookform/resolvers |
| Data | TanStack React Query (provider wired, ready for APIs) |
| Theming | next-themes |
| Toasts | Sonner |

## 📁 Structure

```
primeaxis/
├── app/
│   ├── layout.tsx        # Metadata, fonts, JSON-LD, providers, skip link
│   ├── page.tsx          # Landing page composition (server component)
│   ├── globals.css       # Design tokens, glassmorphism utilities
│   ├── loading.tsx       # Skeleton loading state
│   ├── sitemap.ts        # XML sitemap
│   ├── robots.ts         # robots.txt
│   └── manifest.ts       # PWA manifest
├── components/
│   ├── ui/               # Button, Input, Select, Badge primitives
│   ├── motion/           # Reveal + CountUp animation helpers
│   ├── sections/         # Navbar, Hero, Stats, Categories, Featured,
│   │                     # Map, Calculators, Services, WhyChooseUs,
│   │                     # Testimonials, Developers, News, Pricing,
│   │                     # Newsletter, CTA, Footer
│   └── providers.tsx     # Theme + React Query + Toaster
├── lib/
│   ├── data.ts           # Typed mock data (properties, categories, …)
│   └── utils.ts          # cn(), price formatting
└── tailwind.config.ts    # Brand palette, shadows, keyframes
```

## 🎨 Brand Palette

| Token | Hex |
| --- | --- |
| Primary | `#0F172A` |
| Secondary | `#1E3A8A` |
| Accent | `#10B981` |
| Gold | `#F59E0B` |
| Background | `#F8FAFC` |
| Dark background | `#020617` |

## 🚀 Getting Started

```bash
cd primeaxis
npm install
npm run dev        # http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Type checking

```bash
npm run typecheck
```

## ☁️ Deployment

**Vercel (recommended)**

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new) and set the root directory to `primeaxis/`.
3. Deploy — zero config needed.

**Docker / any Node host**

```bash
npm run build && npm start   # serves on port 3000
```

### Going live checklist

- Replace `https://primeaxis.example.com` in `app/layout.tsx`, `app/sitemap.ts`, and `app/robots.ts` with your production domain.
- Wire the search form, lead form, and newsletter to your API routes (`/api/leads`, `/api/subscribe`) and add rate limiting + CAPTCHA (the honeypot is already in place).
- Add a Google Maps API key to replace the stylised map preview.
- Swap the gradient card artwork for real listing photography via `next/image`.

## 📄 License

MIT — see repository root.
