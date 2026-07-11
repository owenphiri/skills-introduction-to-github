import {
  Banknote,
  DraftingCompass,
  Gavel,
  HandCoins,
  HardHat,
  Home,
  KeyRound,
  Paintbrush,
  ShieldCheck,
  Cpu,
  ClipboardCheck,
  Building,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

const services = [
  { name: "Property Buying", icon: Home, blurb: "End-to-end purchase support, from search to keys." },
  { name: "Property Selling", icon: HandCoins, blurb: "Market pricing, staging, and qualified buyers." },
  { name: "Property Rentals", icon: KeyRound, blurb: "Verified tenants and digital lease signing." },
  { name: "Property Management", icon: ClipboardCheck, blurb: "Full-service management for landlords." },
  { name: "Property Valuation", icon: Banknote, blurb: "Data-driven valuations in 48 hours." },
  { name: "Legal Services", icon: Gavel, blurb: "Title checks, contracts, and conveyancing." },
  { name: "Mortgage Assistance", icon: Building, blurb: "Pre-approval across 40+ lending partners." },
  { name: "Property Insurance", icon: ShieldCheck, blurb: "Cover for buildings, contents, and rent." },
  { name: "Construction", icon: HardHat, blurb: "Vetted contractors and project oversight." },
  { name: "Architecture", icon: DraftingCompass, blurb: "Award-winning residential & commercial design." },
  { name: "Interior Design", icon: Paintbrush, blurb: "Turnkey interiors that lift resale value." },
  { name: "Smart Homes", icon: Cpu, blurb: "Automation, security, and energy systems." },
];

export function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Full-stack real estate</span>
          <h2 id="services-heading" className="section-title">
            Twelve services. One trusted partner.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything the property lifecycle demands — under one roof, with one
            accountable team.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <Reveal key={service.name} delay={(index % 4) * 0.06}>
              <li className="group h-full rounded-2xl border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift">
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-gold/15 text-accent transition-colors group-hover:from-accent group-hover:to-emerald-600 group-hover:text-white">
                  <service.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-bold">{service.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {service.blurb}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
