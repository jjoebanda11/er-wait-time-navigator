import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { config } from '@/lib/config';
import { safeQuery } from '@/lib/db/client';
import { stripe, tierForStatus } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook.
 *
 * Signature verification is mandatory: this endpoint grants paid entitlements,
 * so an unverified POST must never be able to hand someone a subscription.
 * Next.js gives us the raw body via `request.text()`, which is what Stripe's
 * signature is computed over — parsing it as JSON first would break
 * verification.
 */
export async function POST(request: Request) {
  const client = stripe();
  if (!client || !config.billing.webhookSecret) {
    return NextResponse.json({ error: 'Billing is not enabled.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await client.webhooks.constructEventAsync(
      payload,
      signature,
      config.billing.webhookSecret,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid signature' },
      { status: 400 },
    );
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      const tier =
        event.type === 'customer.subscription.deleted'
          ? 'free'
          : tierForStatus(
              subscription.status,
              (subscription.metadata?.tier as string | undefined) ?? 'plus',
            );

      const periodEnd = subscription.items.data[0]?.current_period_end;

      await safeQuery(
        (sql) => sql`
          UPDATE push_subscriptions
          SET subscription_tier       = ${tier},
              subscription_status     = ${subscription.status},
              subscription_expires_at = ${periodEnd ? new Date(periodEnd * 1000) : null}
          WHERE stripe_customer_id = ${customerId}
        `,
        undefined,
      );
      break;
    }

    default:
      // Unhandled event types are acknowledged, not errored — returning a
      // failure would make Stripe retry them forever.
      break;
  }

  return NextResponse.json({ received: true });
}
