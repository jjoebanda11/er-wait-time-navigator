/**
 * Service worker for ER Wait Time Navigator.
 *
 * Two jobs:
 *   1. Keep the app usable with no connection — hospital parkades and
 *      basements have terrible reception, and a board from ten minutes ago is
 *      far more useful than an error page.
 *   2. Receive wait-threshold push notifications.
 *
 * Caching strategy is deliberately network-first for anything carrying wait
 * times. Serving a stale wait time as if it were current would be worse than
 * showing nothing, so cached data is only ever a labelled fallback.
 */

const VERSION = 'v1';
const SHELL_CACHE = `erwtn-shell-${VERSION}`;
const DATA_CACHE = `erwtn-data-${VERSION}`;

/** Routes worth having available offline. */
const SHELL_ASSETS = [
  '/',
  '/triage',
  '/alternatives',
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individual failures must not abort the whole install.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('erwtn-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache these: routing results are per-location, and alert writes must
  // always reach the server.
  if (url.pathname.startsWith('/api/drive-times') || url.pathname.startsWith('/api/alerts')) {
    return;
  }

  const isDataRequest =
    url.pathname.startsWith('/api/') || request.mode === 'navigate';

  if (isDataRequest) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offline = await caches.match('/offline');
      if (offline) return offline;
    }

    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'No connection. For urgent help call 911, or 811 for nurse advice.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Wait time update', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Wait time update', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: payload.tag ?? 'erwtn',
      renotify: false,
      data: { url: payload.url ?? '/' },
      // A wait-time alert is time-critical and worthless if it sits silently.
      requireInteraction: false,
      vibrate: [100, 50, 100],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
