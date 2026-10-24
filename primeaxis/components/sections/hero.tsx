"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Home,
  MapPin,
  PlayCircle,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CountUp } from "@/components/motion/count-up";
import { cn } from "@/lib/utils";

const searchTabs = ["Buy", "Rent", "Commercial", "Land", "Luxury"] as const;

const heroStats = [
  { value: 50000, suffix: "+", label: "Properties" },
  { value: 12000, suffix: "+", label: "Agents" },
  { value: 25, suffix: "", label: "Countries" },
  { value: 1, suffix: "M+", label: "Monthly Visitors" },
];

/** Decorative skyline rendered as inline SVG — zero network cost, crisp at any size. */
function Skyline() {
  return (
    <svg
      aria-hidden="true"
      className="absolute bottom-0 left-0 w-full text-white/[0.06]"
      viewBox="0 0 1440 320"
      fill="currentColor"
      preserveAspectRatio="none"
    >
      <path d="M0 320V220h60v-60h40v60h50V120h70v200h40V180h60v-40h50v40h40v140h60V80h30l10-40 10 40h30v240h50V160h80v160h40V100h90v220h50V200h70v-60h40v60h50v120h60V140h80v180h50V240h70v80z" />
    </svg>
  );
}

export function Hero() {
  const [activeTab, setActiveTab] = useState<(typeof searchTabs)[number]>("Buy");

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.success(`Searching ${activeTab.toLowerCase()} listings…`, {
      description: "Connect this form to your listings API to go live.",
    });
  };

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-[#0F172A] pb-24 pt-32 text-white lg:pb-32 lg:pt-44"
    >
      {/* Layered background: deep navy gradient + aurora glows + skyline */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0F172A] to-[#1E3A8A]/60"
      />
      <div
        aria-hidden="true"
        className="absolute -top-32 left-1/4 size-[500px] rounded-full bg-emerald-500/20 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 top-1/3 size-[420px] rounded-full bg-amber-500/10 blur-[140px]"
      />
      <Skyline />

      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <span className="section-eyebrow border-white/20 bg-white/10 text-emerald-300">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              50,000+ verified listings across 25 countries
            </span>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Find. Buy. Rent.{" "}
              <span className="text-gradient">Invest.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
              PrimeAxis is the premium global property marketplace — luxury homes,
              apartments, land, and commercial real estate, curated by trusted
              agents and backed by institutional-grade market analytics.
            </p>
          </motion.div>

          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button size="lg">
              Explore Properties
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button size="lg" variant="glass" className="text-white dark:text-white">
              <CalendarClock aria-hidden="true" />
              Schedule Consultation
            </Button>
            <Button size="lg" variant="link" className="text-slate-300 hover:text-white">
              <PlayCircle aria-hidden="true" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Search panel */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="mx-auto mt-12 max-w-3xl"
          >
            <div
              role="tablist"
              aria-label="Listing type"
              className="mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-t-2xl border border-b-0 border-white/15 bg-white/10 p-1.5 backdrop-blur-xl"
            >
              {searchTabs.map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                    activeTab === tab
                      ? "bg-accent text-white shadow-glow"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSearch}
              aria-label={`Search ${activeTab} properties`}
              className="glass-strong rounded-2xl rounded-t-none p-4 text-left shadow-lift sm:p-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div className="relative">
                  <MapPin
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <label htmlFor="hero-location" className="sr-only">
                    City, country, or keyword
                  </label>
                  <Input
                    id="hero-location"
                    placeholder="City, country, or keyword…"
                    className="pl-10"
                  />
                </div>
                <div>
                  <label htmlFor="hero-type" className="sr-only">
                    Property type
                  </label>
                  <Select id="hero-type" defaultValue="">
                    <option value="">Property type</option>
                    <option>Apartment</option>
                    <option>House</option>
                    <option>Villa</option>
                    <option>Office</option>
                    <option>Warehouse</option>
                    <option>Plot / Land</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="hero-price" className="sr-only">
                    Price range
                  </label>
                  <Select id="hero-price" defaultValue="">
                    <option value="">Price range</option>
                    <option>Under $100k</option>
                    <option>$100k – $500k</option>
                    <option>$500k – $1M</option>
                    <option>$1M – $5M</option>
                    <option>$5M+</option>
                  </Select>
                </div>
                <Button type="submit" className="h-11 w-full lg:w-auto lg:px-7">
                  <Search aria-hidden="true" />
                  Search
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="hero-beds" className="sr-only">
                    Bedrooms
                  </label>
                  <Select id="hero-beds" defaultValue="">
                    <option value="">Beds: any</option>
                    <option>1+</option>
                    <option>2+</option>
                    <option>3+</option>
                    <option>4+</option>
                    <option>5+</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="hero-baths" className="sr-only">
                    Bathrooms
                  </label>
                  <Select id="hero-baths" defaultValue="">
                    <option value="">Baths: any</option>
                    <option>1+</option>
                    <option>2+</option>
                    <option>3+</option>
                    <option>4+</option>
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="hero-country" className="sr-only">
                    Country
                  </label>
                  <Select id="hero-country" defaultValue="">
                    <option value="">Country: any</option>
                    <option>Nigeria</option>
                    <option>South Africa</option>
                    <option>Kenya</option>
                    <option>Zambia</option>
                    <option>UAE</option>
                    <option>United Kingdom</option>
                  </Select>
                </div>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Floating stat cards */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
          {heroStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
              className={cn(
                "rounded-2xl border border-white/15 bg-white/[0.07] p-4 text-center backdrop-blur-xl",
                index % 2 === 0 ? "animate-float" : "animate-float-slow"
              )}
            >
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">
                <CountUp end={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-400"
        >
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck className="size-4 text-emerald-400" aria-hidden="true" />
            Every listing manually verified
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="size-4 text-emerald-400" aria-hidden="true" />
            Live market analytics
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Home className="size-4 text-emerald-400" aria-hidden="true" />
            Trusted by 12,000+ agents
          </span>
        </motion.div>
      </div>
    </section>
  );
}
