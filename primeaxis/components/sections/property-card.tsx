"use client";

import { useState } from "react";
import {
  Bath,
  BedDouble,
  Calculator,
  Heart,
  MapPin,
  Ruler,
  Scale,
  Share2,
  Star,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Property } from "@/lib/data";
import { cn, formatPrice } from "@/lib/utils";

const badgeStyles: Record<Property["badges"][number], "gold" | "default" | "secondary"> = {
  Featured: "gold",
  New: "default",
  Verified: "secondary",
};

/** Decorative building artwork — inline SVG so cards render instantly with no image requests. */
function CardArtwork({ gradient }: { gradient: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-52 w-full overflow-hidden bg-gradient-to-br transition-transform duration-500 group-hover:scale-[1.04]",
        gradient
      )}
    >
      <svg
        className="absolute bottom-0 left-0 w-full text-white/10"
        viewBox="0 0 400 120"
        fill="currentColor"
        preserveAspectRatio="none"
      >
        <path d="M0 120V70h30V40h25v30h20V20h40v100h25V60h35v-15h25v15h30v60h25V30h45v90h25V75h40v-25h35v70z" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
    </div>
  );
}

export function PropertyCard({ property }: { property: Property }) {
  const [saved, setSaved] = useState(false);

  const action = (message: string) => () =>
    toast(message, { description: property.title });

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
      <div className="relative">
        <CardArtwork gradient={property.gradient} />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {property.badges.map((badge) => (
            <Badge key={badge} variant={badgeStyles[badge]}>
              {badge}
            </Badge>
          ))}
        </div>

        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            aria-label={saved ? "Remove from saved" : "Save property"}
            aria-pressed={saved}
            onClick={() => {
              setSaved((s) => !s);
              toast(saved ? "Removed from saved" : "Saved to your list", {
                description: property.title,
              });
            }}
            className="flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55"
          >
            <Heart className={cn("size-4", saved && "fill-rose-500 text-rose-500")} aria-hidden="true" />
          </button>
          <button
            aria-label="Compare property"
            onClick={action("Added to compare")}
            className="flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55"
          >
            <Scale className="size-4" aria-hidden="true" />
          </button>
          <button
            aria-label="Share property"
            onClick={action("Share link copied")}
            className="flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55"
          >
            <Share2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3">
          <Badge variant="glass" className="px-3 py-1 text-sm font-bold">
            {formatPrice(property.price)}
            {property.period && (
              <span className="font-medium text-muted-foreground">/{property.period}</span>
            )}
          </Badge>
        </div>

        <button
          onClick={action("Launching virtual tour")}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-accent"
        >
          <Video className="size-3.5" aria-hidden="true" />
          Virtual Tour
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug">
            {property.title}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-gold">
            <Star className="size-4 fill-current" aria-hidden="true" />
            {property.rating.toFixed(1)}
          </span>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {property.location}, {property.country}
        </p>

        <dl className="mt-4 flex items-center gap-4 border-t pt-4 text-sm text-muted-foreground">
          {property.beds > 0 && (
            <div className="flex items-center gap-1.5">
              <BedDouble className="size-4" aria-hidden="true" />
              <dt className="sr-only">Bedrooms</dt>
              <dd>{property.beds} bd</dd>
            </div>
          )}
          {property.baths > 0 && (
            <div className="flex items-center gap-1.5">
              <Bath className="size-4" aria-hidden="true" />
              <dt className="sr-only">Bathrooms</dt>
              <dd>{property.baths} ba</dd>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Ruler className="size-4" aria-hidden="true" />
            <dt className="sr-only">Area</dt>
            <dd>{property.area.toLocaleString()} m²</dd>
          </div>
        </dl>

        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" onClick={action("An agent will contact you shortly")}>
            Contact Agent
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Open mortgage calculator"
            onClick={() =>
              document.getElementById("calculators")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Calculator aria-hidden="true" />
            Mortgage
          </Button>
        </div>
      </div>
    </article>
  );
}
