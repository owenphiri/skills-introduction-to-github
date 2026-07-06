import { Plan } from '@prisma/client';

/**
 * The commercial model. The API is the single authority on limits —
 * apps/web/src/lib/plans.ts mirrors the copy for display only.
 * Prices in USD/month; local-currency display handled client-side.
 */
export const PLAN_ORDER: Plan[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

export interface PlanDef {
  name: string;
  priceUsdMonthly: number;
  limits: {
    farms: number;
    houses: number;
    birds: number;
    members: number;
  };
  features: string[];
}

export const PLANS: Record<Plan, PlanDef> = {
  FREE: {
    name: 'Free',
    priceUsdMonthly: 0,
    limits: { farms: 1, houses: 2, birds: 500, members: 2 },
    features: [
      'Daily records & core KPIs (FCR, mortality, egg %)',
      'Basic inventory tracking',
      '30-day data history',
    ],
  },
  STARTER: {
    name: 'Starter',
    priceUsdMonthly: 19,
    limits: { farms: 1, houses: 6, birds: 5_000, members: 5 },
    features: [
      'Everything in Free',
      'Full inventory: suppliers & purchase orders',
      'Vaccination schedules & alerts',
      'Financials: sales, expenses, batch profitability',
      'Unlimited history',
    ],
  },
  PROFESSIONAL: {
    name: 'Professional',
    priceUsdMonthly: 59,
    limits: { farms: 5, houses: 40, birds: 50_000, members: 25 },
    features: [
      'Everything in Starter',
      'Multi-farm with live switching',
      'Real-time dashboard & predictive insights',
      'Environment (temp/humidity) alerting',
      'Shareable performance reports',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    priceUsdMonthly: 199,
    limits: {
      farms: Number.MAX_SAFE_INTEGER,
      houses: Number.MAX_SAFE_INTEGER,
      birds: Number.MAX_SAFE_INTEGER,
      members: Number.MAX_SAFE_INTEGER,
    },
    features: [
      'Everything in Professional',
      'Unlimited farms, birds & users',
      'API access & IoT sensor ingestion',
      'Audit log export',
      'Priority support & onboarding',
    ],
  },
};

export const STRIPE_PRICE_ENV: Partial<Record<Plan, string>> = {
  STARTER: 'STRIPE_PRICE_STARTER',
  PROFESSIONAL: 'STRIPE_PRICE_PROFESSIONAL',
  ENTERPRISE: 'STRIPE_PRICE_ENTERPRISE',
};
