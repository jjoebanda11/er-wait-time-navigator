'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes the app installable and keeps the
 * last-known wait times readable offline.
 *
 * Offline access matters more here than in most apps: hospital basements and
 * parkades have terrible reception, and a cached board from ten minutes ago is
 * far more useful than a connection error.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // A failed registration must never break the page; the app works fine
        // without offline support.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
