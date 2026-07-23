import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { db, safeQuery } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * Create or update a wait-threshold alert.
 *
 * Stores only a push endpoint, a facility slug, and a number of minutes. No
 * email, no name, no symptoms, no location. A leak of this table would reveal
 * which hospital a browser is interested in and nothing more — that minimalism
 * is intentional and is what keeps us clear of health-information regulation.
 */

const MAX_RULES_PER_SUBSCRIPTION = 10;

interface Body {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  facilitySlug?: string;
  facilityName?: string;
  thresholdMinutes?: number;
}

export async function POST(request: Request) {
  if (!config.push.enabled) {
    return NextResponse.json(
      { error: 'Alerts are not enabled on this deployment' },
      { status: 503 },
    );
  }
  if (!db()) {
    return NextResponse.json({ error: 'Alerts require a database' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  const { facilitySlug, facilityName, thresholdMinutes } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'A complete push subscription is required' }, { status: 400 });
  }
  if (!facilitySlug || !facilityName) {
    return NextResponse.json({ error: 'A facility is required' }, { status: 400 });
  }
  if (
    typeof thresholdMinutes !== 'number' ||
    !Number.isFinite(thresholdMinutes) ||
    thresholdMinutes < 15 ||
    thresholdMinutes > 1440
  ) {
    return NextResponse.json(
      { error: 'Threshold must be between 15 and 1440 minutes' },
      { status: 400 },
    );
  }

  const created = await safeQuery(async (sql) => {
    const subscriptionId = randomUUID();

    const [subscription] = await sql<{ id: string }[]>`
      INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
      VALUES (${subscriptionId}, ${endpoint}, ${p256dh}, ${auth})
      ON CONFLICT (endpoint) DO UPDATE
        SET last_seen_at = now(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
      RETURNING id
    `;

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM alert_rules
      WHERE subscription_id = ${subscription.id} AND facility_slug <> ${facilitySlug}
    `;
    if (count >= MAX_RULES_PER_SUBSCRIPTION) {
      return { ok: false as const, error: 'Too many alerts on this device' };
    }

    await sql`
      INSERT INTO alert_rules (id, subscription_id, facility_slug, facility_name, threshold_minutes)
      VALUES (${randomUUID()}, ${subscription.id}, ${facilitySlug}, ${facilityName}, ${Math.round(thresholdMinutes)})
      ON CONFLICT (subscription_id, facility_slug) DO UPDATE
        SET threshold_minutes = EXCLUDED.threshold_minutes,
            active = TRUE,
            last_notified_at = NULL
    `;

    return { ok: true as const };
  }, { ok: false as const, error: 'Could not save this alert' });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** Remove an alert for a facility on this device. */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const facilitySlug = searchParams.get('facilitySlug');

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await safeQuery(async (sql) => {
    if (facilitySlug) {
      await sql`
        DELETE FROM alert_rules
        WHERE facility_slug = ${facilitySlug}
          AND subscription_id IN (SELECT id FROM push_subscriptions WHERE endpoint = ${endpoint})
      `;
    } else {
      // No facility means "forget this device entirely"; the cascade clears
      // every rule with it.
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    }
  }, undefined);

  return NextResponse.json({ ok: true });
}
