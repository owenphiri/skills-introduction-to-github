import { ArrowRight, Clock3 } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { articles } from "@/lib/data";
import { cn } from "@/lib/utils";

export function News() {
  return (
    <section id="news" aria-labelledby="news-heading" className="py-24">
      <div className="container">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <span className="section-eyebrow">Property news</span>
            <h2 id="news-heading" className="section-title">
              Insights that move markets
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Button variant="outline">
              View all articles
              <ArrowRight aria-hidden="true" />
            </Button>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {articles.map((article, index) => (
            <Reveal key={article.title} delay={index * 0.08}>
              <article className="group h-full overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <div
                  aria-hidden="true"
                  className={cn(
                    "relative h-40 bg-gradient-to-br transition-transform duration-500 group-hover:scale-[1.03]",
                    article.gradient
                  )}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline">{article.category}</Badge>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {article.readTime}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold leading-snug transition-colors group-hover:text-accent">
                    <a href="#news">{article.title}</a>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {article.excerpt}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
