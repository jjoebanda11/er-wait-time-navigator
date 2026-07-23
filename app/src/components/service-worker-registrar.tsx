'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker and handles its upgrade path.
 *
 * Offline access matters more here than in most apps: hospital basements and
 * parkades have terrible reception, and a cached board that visibly says
 * "updated 12 minutes ago" is far more useful than a connection error.
 *
 * The upgrade handling is not incidental. A service worker that caches the
 * wrong thing can strand a user on a broken page indefinitely, and that user
 * has no way to know why or to fix it. So we actively check for a new worker on
 * every load, and reload once when one takes over — that reload is the only
 * mechanism by which a bad worker already installed in the wild gets flushed.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    // True only when a worker was already controlling this page at load time.
    // Distinguishes an upgrade (reload, to pick up the new worker's behaviour)
    // from a first install (do not reload — nothing has changed underneath us).
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // /sw.js is served with no-store, so this is a cheap freshness check
        // and is what makes a fix reach existing installs within one visit
        // rather than whenever the browser next feels like checking.
        registration.update().catch(() => {});
      } catch {
        // A failed registration must never break the page; the app works fine
        // without offline support.
      }
    };

    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', () => void register(), { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
