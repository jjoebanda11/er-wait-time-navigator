import Stripe from 'stripe';
import { config } from '../config';

/**
 * Stripe client.
 *
 * Returns `null` whenever billing is not fully switched on, and every caller
 * must handle that. `config.billing.enabled` requires BOTH an explicit
 * `BILLING_ENABLED=true` and a secret key, so a key sitting in the environment
 * during development can never start charging real people.
 */

let client: Stripe | null = null;
let attempted = false;

export function stripe(): Stripe | null {
  if (attempted) return client;
  attempted = true;

  if (!config.billing.enabled || !config.billing.secretKey) return null;

  client = new Stripe(config.billing.secretKey, {
    // Pinning avoids a Stripe-side API change silently altering behaviour.
    apiVersion: '2025-08-27.basil',
    typescript: true,
    appInfo: {
      name: 'ER Wait Time Navigator',
      url: config.site.url,
    },
  });

  return client;
}

export interface CheckoutParams {
  priceId: string;
  /** Existing customer, when we already know one for this device. */
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}

/** Create a Stripe Checkout session for a subscription. */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<{ url: string } | { error: string }> {
  const client = stripe();
  if (!client) return { error: 'Billing is not enabled on this deployment.' };

  try {
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // Alberta has no PST, but GST applies. Stripe Tax handles the
      // registration thresholds correctly once configured in the dashboard.
      automatic_tax: { enabled: true },
      subscription_data: {
        metadata: { product: 'er-wait-time-navigator' },
      },
    });

    if (!session.url) return { error: 'Stripe did not return a checkout URL.' };
    return { url: session.url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not start checkout.',
    };
  }
}

/** Create a billing portal session so a customer can manage or cancel. */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string } | { error: string }> {
  const client = stripe();
  if (!client) return { error: 'Billing is not enabled on this deployment.' };

  try {
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not open the billing portal.',
    };
  }
}

/** Map a Stripe subscription status onto the tier we grant. */
export function tierForStatus(
  status: Stripe.Subscription.Status,
  requestedTier: string,
): string {
  // `past_due` keeps access during Stripe's retry window; cancelling someone's
  // hospital alerts over a temporarily declined card would be indefensible.
  const entitled: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
  return entitled.includes(status) ? requestedTier : 'free';
}
