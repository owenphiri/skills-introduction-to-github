"use client";

import { useMemo, useState } from "react";
import { Calculator, LineChart, Percent, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "mortgage", label: "Mortgage / EMI", icon: Calculator },
  { id: "roi", label: "ROI", icon: TrendingUp },
  { id: "yield", label: "Rental Yield", icon: Percent },
  { id: "appreciation", label: "Appreciation", icon: LineChart },
] as const;

type TabId = (typeof tabs)[number]["id"];

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-muted-foreground">
          {label}
        </label>
        <output htmlFor={id} className="font-semibold text-foreground">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--accent))]"
      />
    </div>
  );
}

function ResultCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 text-center shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold text-accent sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Calculators() {
  const [tab, setTab] = useState<TabId>("mortgage");

  // Shared inputs across calculators
  const [price, setPrice] = useState(450000);
  const [deposit, setDeposit] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const [monthlyRent, setMonthlyRent] = useState(2800);
  const [growth, setGrowth] = useState(6);

  const results = useMemo(() => {
    const loan = price * (1 - deposit / 100);
    const monthlyRate = rate / 100 / 12;
    const n = years * 12;
    // Standard amortised payment formula
    const emi =
      monthlyRate === 0
        ? loan / n
        : (loan * monthlyRate * Math.pow(1 + monthlyRate, n)) /
          (Math.pow(1 + monthlyRate, n) - 1);
    const totalInterest = emi * n - loan;

    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / price) * 100;
    const netYield = grossYield * 0.8; // assume ~20% operating costs

    const futureValue = price * Math.pow(1 + growth / 100, years);
    const totalGain = futureValue - price;
    const cashInvested = price * (deposit / 100);
    const roi = ((totalGain + annualRent * years - totalInterest) / cashInvested) * 100;

    return { loan, emi, totalInterest, grossYield, netYield, futureValue, totalGain, roi };
  }, [price, deposit, rate, years, monthlyRent, growth]);

  return (
    <section
      id="calculators"
      aria-labelledby="calculators-heading"
      className="bg-primary py-24 text-primary-foreground dark:bg-muted/20"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Investment intelligence</span>
          <h2 id="calculators-heading" className="section-title text-primary-foreground dark:text-foreground">
            Run the numbers before you commit
          </h2>
          <p className="mt-4 text-primary-foreground/70 dark:text-muted-foreground">
            Mortgage payments, rental yields, ROI, and appreciation forecasts —
            modelled instantly as you move the sliders.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-12 max-w-4xl">
          <div
            role="tablist"
            aria-label="Calculator type"
            className="flex flex-wrap justify-center gap-2"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                  tab === t.id
                    ? "bg-accent text-white shadow-glow"
                    : "bg-white/10 text-primary-foreground/80 hover:bg-white/20 dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/70"
                )}
              >
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="glass-strong mt-8 grid gap-10 rounded-3xl p-6 text-foreground shadow-lift sm:p-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-7">
              <Slider
                id="calc-price"
                label="Property price"
                value={price}
                min={50000}
                max={5000000}
                step={10000}
                format={(v) => formatPrice(v)}
                onChange={setPrice}
              />
              <Slider
                id="calc-deposit"
                label="Deposit"
                value={deposit}
                min={0}
                max={80}
                step={5}
                format={(v) => `${v}%`}
                onChange={setDeposit}
              />
              <Slider
                id="calc-rate"
                label="Interest rate"
                value={rate}
                min={1}
                max={25}
                step={0.25}
                format={(v) => `${v.toFixed(2)}%`}
                onChange={setRate}
              />
              <Slider
                id="calc-years"
                label="Term"
                value={years}
                min={5}
                max={30}
                step={1}
                format={(v) => `${v} years`}
                onChange={setYears}
              />
              {(tab === "roi" || tab === "yield") && (
                <Slider
                  id="calc-rent"
                  label="Expected monthly rent"
                  value={monthlyRent}
                  min={200}
                  max={20000}
                  step={100}
                  format={(v) => formatPrice(v)}
                  onChange={setMonthlyRent}
                />
              )}
              {(tab === "roi" || tab === "appreciation") && (
                <Slider
                  id="calc-growth"
                  label="Annual appreciation"
                  value={growth}
                  min={0}
                  max={15}
                  step={0.5}
                  format={(v) => `${v.toFixed(1)}%`}
                  onChange={setGrowth}
                />
              )}
            </div>

            <div aria-live="polite" className="grid content-start gap-4">
              {tab === "mortgage" && (
                <>
                  <ResultCard
                    label="Monthly payment (EMI)"
                    value={formatPrice(results.emi)}
                    hint={`on a ${formatPrice(results.loan)} loan`}
                  />
                  <ResultCard
                    label="Total interest"
                    value={formatPrice(results.totalInterest)}
                    hint={`over ${years} years`}
                  />
                </>
              )}
              {tab === "roi" && (
                <>
                  <ResultCard
                    label="Total ROI on cash invested"
                    value={`${results.roi.toFixed(0)}%`}
                    hint={`over ${years} years incl. rent & appreciation`}
                  />
                  <ResultCard label="Capital gain" value={formatPrice(results.totalGain)} />
                </>
              )}
              {tab === "yield" && (
                <>
                  <ResultCard
                    label="Gross rental yield"
                    value={`${results.grossYield.toFixed(2)}%`}
                    hint="annual rent ÷ purchase price"
                  />
                  <ResultCard
                    label="Est. net yield"
                    value={`${results.netYield.toFixed(2)}%`}
                    hint="after ~20% operating costs"
                  />
                </>
              )}
              {tab === "appreciation" && (
                <>
                  <ResultCard
                    label={`Projected value in ${years} years`}
                    value={formatPrice(results.futureValue)}
                    hint={`at ${growth.toFixed(1)}% annual growth`}
                  />
                  <ResultCard label="Expected gain" value={formatPrice(results.totalGain)} />
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Estimates for guidance only — not financial advice. Speak to a
                PrimeAxis mortgage specialist for a personalised assessment.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
