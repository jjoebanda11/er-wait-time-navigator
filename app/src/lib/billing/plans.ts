import { config } from '../config';

/**
 * Subscription plans.
 *
 * The free tier is deliberately generous and permanent. Everything needed to
 * decide where to go in an emergency — live board, door-to-doctor ranking,
 * triage, alternatives, offline access — is free forever and requires no
 * account. Nobody should meet a paywall while deciding where to take a sick
 * child at 2am, and a paywall there would also be terrible business: the free
 * tier is the acquisition engine and the reason the press and the community
 * will recommend it.
 *
 * Paid tiers sell one thing the free tier structurally cannot give: a server
 * watching on your behalf while you are not looking.
 */

export type PlanId = 'free' | 'plus' | 'family';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  /** Stripe price IDs, null until configured. */
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  features: string[];
  /** Things this tier explicitly does not gate, stated to build trust. */
  alwaysFree?: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need in the moment. No account, forever.',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceId: null,
    annualPriceId: null,
    features: [
      'Live wait times for every Alberta emergency and urgent care site',
      'Door-to-doctor ranking — wait plus your drive plus parking',
      'Children’s emergency routing when the patient is a child',
      'Symptom triage that always errs toward the ER',
      'Full alternative care directory and crisis numbers',
      'Works offline and installs to your home screen',
      'No sign-up, no tracking, location never leaves your device',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'For when you need to know before you need to go.',
    monthlyPrice: 3.99,
    annualPrice: 39.99,
    monthlyPriceId: config.billing.prices.plusMonthly,
    annualPriceId: config.billing.prices.plusAnnual,
    highlight: true,
    features: [
      'Everything in Free',
      'Wait-threshold alerts — we watch and notify when a site drops',
      'Unlimited saved facilities with alerts on each',
      'Full historical trends and best-time-to-go for every site',
      'Predicted wait for the next few hours, not just right now',
    ],
    alwaysFree: ['Live wait times and ranking are never behind this'],
  },
  {
    id: 'family',
    name: 'Family',
    tagline: 'For households managing care for more than themselves.',
    monthlyPrice: 7.99,
    annualPrice: 79.99,
    monthlyPriceId: config.billing.prices.familyMonthly,
    annualPriceId: config.billing.prices.familyAnnual,
    features: [
      'Everything in Plus',
      'Up to 6 family members with individual care profiles',
      'Age-aware routing for each person, including pediatric preference',
      'Share a live "we are heading here" link with family',
      'Caregiver alerts for an elderly parent at a different address',
    ],
  },
];

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** True when a plan can actually be purchased in this deployment. */
export function isPurchasable(plan: Plan, interval: 'monthly' | 'annual'): boolean {
  if (!config.billing.enabled) return false;
  const priceId = interval === 'monthly' ? plan.monthlyPriceId : plan.annualPriceId;
  return Boolean(priceId);
}

export function formatPrice(amount: number): string {
  return amount === 0
    ? 'Free'
    : new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 2,
      }).format(amount);
}
