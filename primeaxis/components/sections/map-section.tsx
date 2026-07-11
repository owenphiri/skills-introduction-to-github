import {
  Bus,
  Fuel,
  GraduationCap,
  Hospital,
  MapPin,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

const amenities = [
  { label: "Schools", icon: GraduationCap, distance: "0.4 km" },
  { label: "Hospitals", icon: Hospital, distance: "1.2 km" },
  { label: "Restaurants", icon: UtensilsCrossed, distance: "0.2 km" },
  { label: "Shopping Malls", icon: ShoppingBag, distance: "0.8 km" },
  { label: "Fuel Stations", icon: Fuel, distance: "0.6 km" },
  { label: "Public Transport", icon: Bus, distance: "0.1 km" },
];

const pins = [
  { top: "22%", left: "30%" },
  { top: "48%", left: "58%" },
  { top: "35%", left: "72%" },
  { top: "62%", left: "38%" },
  { top: "70%", left: "68%" },
];

export function MapSection() {
  return (
    <section aria-labelledby="map-heading" className="py-24">
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="section-eyebrow">Neighbourhood intelligence</span>
          <h2 id="map-heading" className="section-title">
            Explore every location, down to the street
          </h2>
          <p className="mt-4 text-muted-foreground">
            Our interactive map layers verified listings with the amenities that
            matter — schools, hospitals, transport, and lifestyle — so you can
            judge a neighbourhood before you ever visit it. Google Maps
            integration plugs in with a single API key.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {amenities.map((amenity) => (
              <li
                key={amenity.label}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-soft"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-blue-300">
                  <amenity.icon className="size-4.5 size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{amenity.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    avg. {amenity.distance}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Stylised map placeholder — swap for a Google Maps embed in production */}
        <Reveal delay={0.15}>
          <div
            role="img"
            aria-label="Interactive map preview showing verified property locations"
            className="relative aspect-[4/3] overflow-hidden rounded-3xl border shadow-lift"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800" />
            {/* street grid */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full text-slate-400/30 dark:text-slate-500/20"
              viewBox="0 0 400 300"
            >
              <g stroke="currentColor" strokeWidth="1.5" fill="none">
                <path d="M0 60 H400 M0 140 H400 M0 220 H400" />
                <path d="M80 0 V300 M180 0 V300 M300 0 V300" />
                <path d="M0 280 Q120 200 220 240 T400 180" strokeWidth="3" opacity="0.6" />
                <circle cx="180" cy="140" r="40" opacity="0.4" />
              </g>
            </svg>
            {pins.map((pin, index) => (
              <span
                key={index}
                aria-hidden="true"
                style={{ top: pin.top, left: pin.left }}
                className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white shadow-glow animate-float"
              >
                <MapPin className="size-4" />
              </span>
            ))}
            <div className="glass-strong absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm shadow-soft">
              <span className="font-semibold">2,340 verified listings in view</span>
              <span className="text-xs text-muted-foreground">Google Maps ready</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
