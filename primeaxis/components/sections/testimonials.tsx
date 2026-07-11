"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { testimonials } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % testimonials.length),
    []
  );
  const prev = () =>
    setIndex((i) => (i - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [paused, next]);

  const current = testimonials[index];

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Client stories</span>
          <h2 id="testimonials-heading" className="section-title">
            Trusted by buyers, sellers & investors
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-14 max-w-3xl">
          <div className="relative rounded-3xl border bg-card p-8 shadow-lift sm:p-12">
            <Quote
              aria-hidden="true"
              className="absolute -top-5 left-8 size-10 rounded-xl bg-accent p-2 text-white shadow-glow"
            />
            <div aria-live="polite" className="min-h-[180px]">
              <AnimatePresence mode="wait">
                <motion.figure
                  key={index}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ duration: 0.35 }}
                >
                  <div
                    className="flex gap-1"
                    aria-label={`Rated ${current.rating} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        aria-hidden="true"
                        className={cn(
                          "size-4",
                          starIndex < current.rating
                            ? "fill-gold text-gold"
                            : "text-muted"
                        )}
                      />
                    ))}
                  </div>
                  <blockquote className="mt-4 font-display text-lg leading-relaxed sm:text-xl">
                    “{current.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-sm font-bold text-white"
                    >
                      {current.initials}
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {current.name}
                        <BadgeCheck
                          className="size-4 text-accent"
                          aria-label="Verified customer"
                        />
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {current.role}
                      </span>
                    </span>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="flex gap-2" role="tablist" aria-label="Testimonial selector">
                {testimonials.map((testimonial, dotIndex) => (
                  <button
                    key={testimonial.name}
                    role="tab"
                    aria-selected={dotIndex === index}
                    aria-label={`Show testimonial from ${testimonial.name}`}
                    onClick={() => setIndex(dotIndex)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      dotIndex === index ? "w-8 bg-accent" : "w-2 bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Previous testimonial" onClick={prev}>
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next testimonial" onClick={next}>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
