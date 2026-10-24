import { ArrowUpRight, Building2, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { developers } from "@/lib/data";

export function Developers() {
  return (
    <section
      id="developers"
      aria-labelledby="developers-heading"
      className="bg-muted/50 py-24 dark:bg-muted/20"
    >
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="section-eyebrow">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Partner developers
          </span>
          <h2 id="developers-heading" className="section-title">
            Premium projects & off-plan opportunities
          </h2>
          <p className="mt-4 text-muted-foreground">
            We partner with the region&apos;s most accomplished developers to bring
            you early access to off-plan developments — with escrow-protected
            payment plans, transparent build milestones, and pre-launch pricing
            reserved for PrimeAxis members.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button>
              Browse investment opportunities
              <ArrowUpRight aria-hidden="true" />
            </Button>
            <Button variant="outline">Become a partner developer</Button>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {developers.map((developer, index) => (
            <Reveal key={developer.name} delay={index * 0.08}>
              <article className="group h-full rounded-2xl border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-slate-800 text-white">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <Badge variant="outline">{developer.projects} projects</Badge>
                </div>
                <h3 className="mt-4 font-display text-base font-bold">{developer.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{developer.focus}</p>
                <a
                  href="#cta"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:underline"
                >
                  View portfolio
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
