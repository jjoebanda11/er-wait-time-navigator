import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createCheckoutSession } from '@/lib/billing/stripe';
import { getPlan, isPurchasable, type PlanId } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!config.billing.enabled) {
    return NextResponse.json(
      { error: 'Subscriptions are not available yet.' },
      { status: 503 },
    );
  }

  let body: { planId?: string; interval?: string };
  try {
    body = (await request.json()) as { planId?: string; interval?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const interval = body.interval === 'annual' ? 'annual' : 'monthly';
  const plan = getPlan(body.planId as PlanId);

  if (!plan || plan.id === 'free') {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }
  if (!isPurchasable(plan, interval)) {
    return NextResponse.json(
      { error: 'That plan is not configured for purchase.' },
      { status: 400 },
    );
  }

  const priceId = interval === 'annual' ? plan.annualPriceId! : plan.monthlyPriceId!;

  const result = await createCheckoutSession({
    priceId,
    successUrl: `${config.site.url}/plus?checkout=success`,
    cancelUrl: `${config.site.url}/plus?checkout=cancelled`,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ url: result.url });
}
