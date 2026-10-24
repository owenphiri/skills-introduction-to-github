import Link from 'next/link';
import { BarChart3, Bell, Package, Smartphone, Wallet, Waypoints } from 'lucide-react';
import { FollowUs } from '@/components/social/follow-us';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { brand } from '@/lib/brand';
import { PLANS } from '@/lib/plans';

const features = [
  { Icon: BarChart3, title: 'Live KPIs & analytics', body: 'FCR, daily gain, mortality and egg production update the second your team enters data — with 7-day predictive trends.' },
  { Icon: Bell, title: 'Smart alerts', body: 'Mortality spikes, low feed stock, temperature excursions and due vaccinations reach you instantly.' },
  { Icon: Package, title: 'Inventory & purchasing', body: 'Feed, vaccines, meds and packaging with reorder alerts, suppliers and purchase orders.' },
  { Icon: Wallet, title: 'Profit per batch', body: 'Every bag of feed is attributed to a flock, so you see the true margin of every batch.' },
  { Icon: Waypoints, title: 'Maps & Waze directions', body: 'One tap navigates drivers to your farms and suppliers with live Waze routing.' },
  { Icon: Smartphone, title: 'Installable app', body: 'A fast PWA that installs on Android and iOS and opens right in the poultry house.' },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <nav className="mb-12 flex items-center justify-between text-left">
          <span className="flex items-center gap-2 font-semibold">
            <span className="text-xl">🐔</span> {brand.name}
          </span>
          <Link
            href="/sign-in"
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Launch app
          </Link>
        </nav>
        <Badge tone="brand">From 50 birds to 100,000+</Badge>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Run your poultry farm like a business, not a guessing game.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{brand.tagline}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-card bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Start free — 500 birds
          </Link>
          <a href="#pricing" className="rounded-card border border-border px-6 py-3 font-medium">
            See pricing
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ Icon, title, body }) => (
          <Card key={title}>
            <Icon className="size-6 text-primary" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </Card>
        ))}
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">Simple plans that grow with your flock</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={'popular' in plan && plan.popular ? 'border-primary shadow-md' : ''}
            >
              {'popular' in plan && plan.popular && <Badge tone="brand">Most popular</Badge>}
              <h3 className="mt-2 font-semibold">{plan.name}</h3>
              <p className="mt-1 text-3xl font-bold">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-good">✓</span> {h}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pay by card (Visa/Mastercard via Stripe), PayPal or crypto (BTC, ETH, USDC).
        </p>
      </section>

      {/* Social */}
      <section className="border-t border-border bg-surface px-4 py-12">
        <FollowUs />
        <p className="mt-8 text-center text-xs text-faint-foreground">
          © 2026 {brand.company}
        </p>
      </section>
    </main>
  );
}
