import {
  BadgeCheck,
  BarChart3,
  Bot,
  Globe2,
  Headset,
  Lock,
  UserCheck,
  Video,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

const reasons = [
  {
    title: "Verified Listings",
    blurb: "Every property is document-checked and site-verified before it goes live. Zero ghost listings.",
    icon: BadgeCheck,
  },
  {
    title: "Trusted Agents",
    blurb: "12,000+ licensed agents, each vetted, rated, and held to a public code of conduct.",
    icon: UserCheck,
  },
  {
    title: "Secure Transactions",
    blurb: "Escrow-backed payments and encrypted document exchange protect every deal.",
    icon: Lock,
  },
  {
    title: "AI Recommendations",
    blurb: "Our matching engine learns your taste and surfaces properties before they trend.",
    icon: Bot,
  },
  {
    title: "Market Analytics",
    blurb: "Price histories, yield maps, and demand signals — the data institutions use, free.",
    icon: BarChart3,
  },
  {
    title: "Virtual Tours",
    blurb: "Walk through any listing in 3D from anywhere in the world, on any device.",
    icon: Video,
  },
  {
    title: "24/7 Support",
    blurb: "Real humans, around the clock, in your timezone and your language.",
    icon: Headset,
  },
  {
    title: "Global Investors",
    blurb: "Cross-border purchase support: FX, tax guidance, and remote closing in 25 countries.",
    icon: Globe2,
  },
];

export function WhyChooseUs() {
  return (
    <section
      aria-labelledby="why-heading"
      className="bg-muted/50 py-24 dark:bg-muted/20"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Why PrimeAxis</span>
          <h2 id="why-heading" className="section-title">
            Built on trust. Engineered for results.
          </h2>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason, index) => (
            <Reveal key={reason.title} delay={(index % 4) * 0.06}>
              <li className="glass h-full rounded-2xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary dark:bg-secondary/25 dark:text-blue-300">
                  <reason.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-bold">{reason.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {reason.blurb}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
