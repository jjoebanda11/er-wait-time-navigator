import webpush from 'web-push';
import type { NormalizedFacility } from '../ahs/types';
import { config } from '../config';
import { db, safeQuery } from '../db/client';
import { formatDuration } from '../rank';

/**
 * Wait-threshold alerts.
 *
 * A user says "tell me when the Misericordia drops under three hours" and we
 * notify them when it does. This is the single most-requested capability in the
 * problem research and the natural anchor for the paid tier, because it
 * requires a server to be watching on the user's behalf.
 */

let configured = false;

function ensureConfigured(): boolean {
  if (!config.push.enabled) return false;
  if (!configured) {
    webpush.setVapidDetails(
      config.push.subject,
      config.push.publicKey!,
      config.push.privateKey!,
    );
    configured = true;
  }
  return true;
}

/**
 * Minimum gap between notifications for the same rule.
 *
 * Without this, a wait oscillating around the threshold notifies on every cron
 * tick. Someone who has just been told to drive to a hospital does not need to
 * be told again six times.
 */
const RENOTIFY_COOLDOWN_HOURS = 4;

export interface DispatchResult {
  enabled: boolean;
  matched: number;
  sent: number;
  pruned: number;
}

interface DueRule {
  rule_id: string;
  subscription_id: string;
  facility_slug: string;
  facility_name: string;
  threshold_minutes: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send notifications for every rule whose facility is now at or below its
 * threshold. Safe to call unconditionally — it no-ops without push keys or a
 * database.
 */
export async function dispatchAlerts(
  facilities: NormalizedFacility[],
): Promise<DispatchResult> {
  const result: DispatchResult = { enabled: false, matched: 0, sent: 0, pruned: 0 };

  if (!ensureConfigured()) return result;
  const sql = db();
  if (!sql) return result;

  result.enabled = true;

  // Only facilities publishing a real wait can satisfy a threshold.
  const current = new Map(
    facilities
      .filter((f) => f.waitMinutes != null)
      .map((f) => [f.slug, f.waitMinutes as number]),
  );
  if (current.size === 0) return result;

  const slugs = [...current.keys()];

  const due = await safeQuery<DueRule[]>(
    (client) => client<DueRule[]>`
      SELECT
        r.id              AS rule_id,
        r.subscription_id,
        r.facility_slug,
        r.facility_name,
        r.threshold_minutes,
        s.endpoint,
        s.p256dh,
        s.auth
      FROM alert_rules r
      JOIN push_subscriptions s ON s.id = r.subscription_id
      WHERE r.active
        AND r.facility_slug = ANY(${slugs})
        AND (
          r.last_notified_at IS NULL
          OR r.last_notified_at < now() - (${RENOTIFY_COOLDOWN_HOURS} || ' hours')::interval
        )
    `,
    [],
  );

  const triggered = due.filter((rule) => {
    const wait = current.get(rule.facility_slug);
    return wait != null && wait <= rule.threshold_minutes;
  });
  result.matched = triggered.length;

  const notifiedRuleIds: string[] = [];
  const deadSubscriptionIds: string[] = [];

  await Promise.all(
    triggered.map(async (rule) => {
      const wait = current.get(rule.facility_slug)!;
      const payload = JSON.stringify({
        title: `${rule.facility_name} is down to ${formatDuration(wait)}`,
        body: `That's at or below your ${formatDuration(rule.threshold_minutes)} alert. Remember to add your drive time — tap to see the full ranking.`,
        url: `/facility/${rule.facility_slug}`,
        tag: `wait-${rule.facility_slug}`,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: rule.endpoint,
            keys: { p256dh: rule.p256dh, auth: rule.auth },
          },
          payload,
          { TTL: 900 }, // Useless after 15 minutes; a stale wait alert misleads.
        );
        notifiedRuleIds.push(rule.rule_id);
      } catch (error) {
        // 404/410 mean the browser subscription is gone for good.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          deadSubscriptionIds.push(rule.subscription_id);
        }
      }
    }),
  );

  result.sent = notifiedRuleIds.length;

  if (notifiedRuleIds.length > 0) {
    await safeQuery(
      (client) =>
        client`UPDATE alert_rules SET last_notified_at = now() WHERE id = ANY(${notifiedRuleIds})`,
      undefined,
    );
  }

  if (deadSubscriptionIds.length > 0) {
    await safeQuery(
      (client) =>
        client`DELETE FROM push_subscriptions WHERE id = ANY(${deadSubscriptionIds})`,
      undefined,
    );
    result.pruned = deadSubscriptionIds.length;
  }

  return result;
}
