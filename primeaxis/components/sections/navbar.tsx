"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  Menu,
  Moon,
  PlusCircle,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { navLinks } from "@/lib/data";
import { cn } from "@/lib/utils";

const megaMenu = {
  label: "Explore",
  columns: [
    {
      heading: "Residential",
      links: ["Luxury Homes", "Apartments", "Vacation Homes", "Student Housing"],
    },
    {
      heading: "Commercial",
      links: ["Office Spaces", "Warehouses", "Hotels & Lodges", "Industrial Parks"],
    },
    {
      heading: "Land & Development",
      links: ["Serviced Plots", "Off-Plan Projects", "Partner Developers", "Investment Deals"],
    },
  ],
};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass-strong shadow-soft" : "bg-transparent"
      )}
    >
      <nav aria-label="Main navigation" className="container flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link href="#" className="flex items-center gap-2.5" aria-label="PrimeAxis home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-emerald-700 text-white shadow-glow">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Prime<span className="text-accent">Axis</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={megaOpen}
              aria-haspopup="true"
              onClick={() => setMegaOpen((open) => !open)}
            >
              {megaMenu.label}
              <ChevronDown
                className={cn("size-3.5 transition-transform", megaOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <AnimatePresence>
              {megaOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="glass-strong absolute left-0 top-full mt-2 grid w-[560px] grid-cols-3 gap-6 rounded-2xl p-6 shadow-lift"
                >
                  {megaMenu.columns.map((col) => (
                    <div key={col.heading}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                        {col.heading}
                      </p>
                      <ul className="space-y-1.5">
                        {col.links.map((link) => (
                          <li key={link}>
                            <a
                              href="#categories"
                              className="text-sm text-foreground/75 transition-colors hover:text-accent"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {navLinks.slice(0, 6).map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Button variant="ghost" size="sm">
            Login
          </Button>
          <Button variant="outline" size="sm">
            Register
          </Button>
          <Button size="sm">
            <PlusCircle aria-hidden="true" />
            Post Property
          </Button>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="glass-strong overflow-hidden border-t lg:hidden"
          >
            <div className="container flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t pt-4">
                <Button variant="outline">Login / Register</Button>
                <Button>
                  <PlusCircle aria-hidden="true" />
                  Post Property
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
