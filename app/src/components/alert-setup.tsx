'use client';

import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/rank';

/**
 * Convert the base64url VAPID key into the byte array the Push API expects.
 *
 * Backed by an explicitly-allocated ArrayBuffer rather than the default
 * `new Uint8Array(length)`, because TypeScript 5.9 types the latter as
 * `Uint8Array<ArrayBufferLike>`, which does not satisfy `BufferSource`.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; threshold: number }
  | { kind: 'error'; message: string };

const THRESHOLD_CHOICES = [60, 120, 180, 240, 360];

interface Props {
  facilitySlug: string;
  facilityName: string;
  /** False when the deployment has no VAPID keys or no database configured. */
  available: boolean;
  vapidPublicKey: string | null;
}

/**
 * Wait-threshold alert signup.
 *
 * Presented only when the deployment can actually deliver — offering a button
 * that silently does nothing would be worse than omitting the feature.
 */
export function AlertSetup({ facilitySlug, facilityName, available, vapidPublicKey }: Props) {
  const [threshold, setThreshold] = useState(180);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    );
  }, []);

  if (!available || !vapidPublicKey) {
    return (
      <div className="rounded-xl surface p-4">
        <h3 className="font-bold">Get told when this drops</h3>
        <p className="mt-1 text-sm text-muted">
          Wait-threshold alerts are not switched on for this deployment yet. In the meantime, save
          this facility on the live board to keep it at the top of your list.
        </p>
      </div>
    );
  }

  const subscribe = async () => {
    setStatus({ kind: 'working' });
    try {
      if (!supported) throw new Error('This browser does not support notifications.');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error(
          'Notification permission was declined. You can re-enable it in your browser settings.',
        );
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          facilitySlug,
          facilityName,
          thresholdMinutes: threshold,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Could not save this alert.');
      }

      setStatus({ kind: 'done', threshold });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  if (status.kind === 'done') {
    return (
      <div
        className="rounded-xl border-2 p-4"
        style={{
          borderColor: 'var(--color-band-green)',
          background: 'var(--color-band-green-soft)',
        }}
      >
        <h3 className="font-bold" style={{ color: 'var(--color-band-green)' }}>
          Alert set
        </h3>
        <p className="mt-1 text-sm">
          We&rsquo;ll notify you when {facilityName} drops to {formatDuration(status.threshold)} or
          less. Remember to add your own travel time when you get it — and if this becomes urgent
          before then, don&rsquo;t wait for the alert.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="mt-3 text-sm font-semibold underline"
        >
          Change threshold
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl surface p-4">
      <h3 className="font-bold">Get told when this drops</h3>
      <p className="mt-1 text-sm text-muted">
        We&rsquo;ll watch {facilityName} and send one notification when the posted wait falls to
        your threshold. No account needed.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {THRESHOLD_CHOICES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setThreshold(minutes)}
            aria-pressed={threshold === minutes}
            className="rounded-lg border-2 px-3 py-1.5 text-sm font-semibold"
            style={
              threshold === minutes
                ? { borderColor: 'var(--color-brand-600)', background: 'var(--bg-subtle)' }
                : undefined
            }
          >
            Under {formatDuration(minutes)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={subscribe}
        disabled={status.kind === 'working' || !supported}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {status.kind === 'working' ? 'Setting up…' : 'Alert me'}
      </button>

      {!supported && (
        <p className="mt-2 text-sm text-muted">
          This browser doesn&rsquo;t support push notifications. On iPhone, add this site to your
          home screen first, then alerts will work.
        </p>
      )}

      {status.kind === 'error' && (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-band-red)' }}>
          {status.message}
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Never use an alert to decide whether to seek urgent care. If you need care now, go now.
      </p>
    </div>
  );
}
