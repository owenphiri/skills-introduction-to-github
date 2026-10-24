"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/sections/property-card";
import { properties, type Property } from "@/lib/data";
import { cn } from "@/lib/utils";

const filters = ["All", "Buy", "Rent", "Commercial", "Land", "Luxury"] as const;

export function FeaturedProperties() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const visible: Property[] =
    filter === "All" ? properties : properties.filter((p) => p.type === filter);

  return (
    <section
      id="featured"
      aria-labelledby="featured-heading"
      className="bg-muted/50 py-24 dark:bg-muted/20"
    >
      <div className="container">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <span className="section-eyebrow">Handpicked for you</span>
            <h2 id="featured-heading" className="section-title">
              Featured properties
            </h2>
            <p className="mt-4 text-muted-foreground">
              Verified, high-demand listings selected by our market analysts —
              refreshed daily across all 25 countries.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div
              role="group"
              aria-label="Filter properties by type"
              className="flex flex-wrap gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft"
            >
              {filters.map((item) => (
                <button
                  key={item}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                    filter === item
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((property, index) => (
            <Reveal key={property.id} delay={index * 0.07}>
              <PropertyCard property={property} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 text-center">
          <Button size="lg" variant="outline">
            View all 50,000+ properties
            <ArrowRight aria-hidden="true" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
