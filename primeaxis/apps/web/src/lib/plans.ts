/**
 * Display copy for the pricing/billing pages. The API is the authority on
 * limits and prices (GET /plans) — this mirror exists so the public landing
 * page renders instantly with no API round-trip.
 */
export const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    blurb: 'For backyard flocks getting organized',
    highlights: ['Up to 500 birds', 'Daily records & core KPIs', 'Basic inventory', '30-day history'],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price: 19,
    blurb: 'For growing farms that sell every week',
    highlights: ['Up to 5,000 birds', 'Suppliers & purchase orders', 'Vaccination alerts', 'Batch profitability'],
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: 59,
    blurb: 'For commercial operations',
    popular: true,
    highlights: ['Up to 50,000 birds', 'Multi-farm switching', 'Real-time dashboard & predictions', 'Environment alerts'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    blurb: 'For integrators and estates',
    highlights: ['Unlimited birds & farms', 'API + IoT ingestion', 'Audit log export', 'Priority support'],
  },
] as const;

export type PlanId = (typeof PLANS)[number]['id'];
