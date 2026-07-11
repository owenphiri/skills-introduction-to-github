import { Check, Crown } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "For individual owners listing their first property.",
    features: [
      "3 active listings",
      "Standard search placement",
      "Email lead notifications",
      "Basic listing analytics",
    ],
    cta: "Start for free",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$49",
    period: "per month",
    blurb: "For active agents who live on their pipeline.",
    features: [
      "Unlimited listings",
      "Built-in CRM & lead scoring",
      "Full market analytics suite",
      "Marketing & social tools",
      "Priority search placement",
      "Verified agent badge",
    ],
    cta: "Start 14-day trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual billing",
    blurb: "For agencies, developers, and property managers.",
    features: [
      "Everything in Professional",
      "Team seats & role permissions",
      "API & MLS integrations",
      "Dedicated account manager",
      "White-label microsites",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-muted/50 py-24 dark:bg-muted/20"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">For agents & agencies</span>
          <h2 id="pricing-heading" className="section-title">
            Plans that scale with your portfolio
          </h2>
          <p className="mt-4 text-muted-foreground">
            Unlimited listings, a built-in CRM, analytics, and marketing tools —
            everything a modern agent needs to close more deals.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.08}>
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border bg-card p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
                  plan.highlighted &&
                    "border-accent/50 shadow-glow ring-1 ring-accent/40 lg:-translate-y-3 lg:hover:-translate-y-4"
                )}
              >
                {plan.highlighted && (
                  <Badge variant="gold" className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1">
                    <Crown className="size-3.5" aria-hidden="true" />
                    Most popular
                  </Badge>
                )}
                <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                <p className="mt-6">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{plan.period}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
