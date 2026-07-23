/**
 * Runtime configuration and feature flags.
 *
 * Design rule for this product: the core experience — live wait times, ranking,
 * triage, alternative care — must work with an entirely empty `.env`. Every
 * integration below is an optional upgrade that switches itself on when its
 * credentials appear, and stays invisible when they do not. That is what makes
 * the app deployable today with zero accounts and zero dollars.
 */

const env = process.env;

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

export const config = {
  site: {
    name: 'ER Wait Time Navigator',
    shortName: 'ER Navigator',
    /** Canonical origin, used for metadata, sitemap and share links. */
    url: (env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@erwaitnavigator.ca',
    /** Shown in the legal pages. Update once the business is registered. */
    legalEntity: env.NEXT_PUBLIC_LEGAL_ENTITY ?? 'ER Wait Time Navigator',
  },

  /** Historical trends and best-time-to-go activate when a database exists. */
  database: {
    url: env.DATABASE_URL ?? null,
    get enabled() {
      return Boolean(env.DATABASE_URL);
    },
  },

  /** Web push alerts activate when VAPID keys are present. */
  push: {
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    privateKey: env.VAPID_PRIVATE_KEY ?? null,
    subject: env.VAPID_SUBJECT ?? 'mailto:hello@erwaitnavigator.ca',
    get enabled() {
      return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    },
  },

  /**
   * Billing is built in full but dark by default. Turning it on requires both
   * a Stripe key and an explicit opt-in flag, so a stray key in the
   * environment can never start charging people by accident.
   */
  billing: {
    enabled: bool(env.BILLING_ENABLED) && Boolean(env.STRIPE_SECRET_KEY),
    secretKey: env.STRIPE_SECRET_KEY ?? null,
    publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
    prices: {
      plusMonthly: env.STRIPE_PRICE_PLUS_MONTHLY ?? null,
      plusAnnual: env.STRIPE_PRICE_PLUS_ANNUAL ?? null,
      familyMonthly: env.STRIPE_PRICE_FAMILY_MONTHLY ?? null,
      familyAnnual: env.STRIPE_PRICE_FAMILY_ANNUAL ?? null,
    },
  },

  routing: {
    orsApiKey: env.ORS_API_KEY,
    googleRoutesApiKey: env.GOOGLE_ROUTES_API_KEY,
  },

  /** Shared secret protecting the snapshot cron endpoint. */
  cronSecret: env.CRON_SECRET ?? null,
} as const;

/** Public subset safe to send to the browser. */
export function publicConfig() {
  return {
    siteName: config.site.name,
    siteUrl: config.site.url,
    pushEnabled: config.push.enabled,
    pushPublicKey: config.push.publicKey,
    billingEnabled: config.billing.enabled,
    historyEnabled: config.database.enabled,
  };
}

export type PublicConfig = ReturnType<typeof publicConfig>;
