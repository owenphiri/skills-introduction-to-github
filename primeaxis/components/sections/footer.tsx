import {
  Building2,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Youtube,
} from "lucide-react";

const columns = [
  {
    heading: "Company",
    links: ["About Us", "Careers", "Press", "Partners", "Investor Relations"],
  },
  {
    heading: "Services",
    links: ["Buy Property", "Rent Property", "Sell Property", "Property Management", "Valuations"],
  },
  {
    heading: "Resources",
    links: ["Blog", "Buying Guide", "Selling Guide", "Legal Guide", "Market Reports"],
  },
  {
    heading: "For Professionals",
    links: ["Agent Pricing", "Developer Portal", "API & Integrations", "Advertise", "Support"],
  },
];

const socials = [
  { label: "WhatsApp", icon: MessageCircle, href: "https://wa.me/" },
  { label: "LinkedIn", icon: Linkedin, href: "https://linkedin.com/company/primeaxis" },
  { label: "Facebook", icon: Facebook, href: "https://facebook.com/primeaxis" },
  { label: "Instagram", icon: Instagram, href: "https://instagram.com/primeaxis" },
  { label: "YouTube", icon: Youtube, href: "https://youtube.com/@primeaxis" },
];

export function Footer() {
  return (
    <footer className="border-t bg-[#020617] text-slate-300">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <a href="#" className="flex items-center gap-2.5" aria-label="PrimeAxis home">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-bold text-white">
                Prime<span className="text-emerald-400">Axis</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              The premium global property marketplace. Find. Buy. Rent. Invest —
              across 25 countries with total confidence.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-emerald-400" aria-hidden="true" />
                <a href="tel:+260000000000" className="hover:text-white">
                  +260 000 000 000
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-emerald-400" aria-hidden="true" />
                <a href="mailto:hello@primeaxis.example.com" className="hover:text-white">
                  hello@primeaxis.example.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-emerald-400" aria-hidden="true" />
                Global HQ · Lusaka · Dubai · London
              </li>
            </ul>
            <div className="mt-6 flex gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/20 hover:text-white"
                >
                  <social.icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-400 transition-colors hover:text-emerald-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} PrimeAxis Property Marketplace. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-300">
              Terms of Service
            </a>
            <a href="#" className="hover:text-slate-300">
              Cookie Settings
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
