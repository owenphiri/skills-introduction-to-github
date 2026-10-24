import { Reveal } from "@/components/motion/reveal";
import { categories } from "@/lib/data";

export function Categories() {
  return (
    <section id="categories" aria-labelledby="categories-heading" className="py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Browse by category</span>
          <h2 id="categories-heading" className="section-title">
            Every asset class, one marketplace
          </h2>
          <p className="mt-4 text-muted-foreground">
            From penthouse suites to industrial parks — explore ten specialised
            categories curated for buyers, tenants, and investors.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category, index) => (
            <Reveal key={category.name} delay={index * 0.05}>
              <li className="group h-full">
                <a
                  href="#featured"
                  className="flex h-full flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-lift"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <category.icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {category.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.count} listings
                  </span>
                </a>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
