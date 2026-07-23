/**
 * Service worker for ER Wait Time Navigator.
 *
 * Design rule, learned the hard way: **only content-addressed assets may ever be
 * served cache-first.** Everything else on this site can carry a wait time, and a
 * confidently-served stale wait time is more dangerous than no page at all.
 *
 * The previous revision violated that in two ways, both fixed here:
 *
 *   1. It precached `/`, `/triage` and `/alternatives` as HTML. That HTML embeds
 *      build-specific chunk URLs, which 404 after any redeploy, so the offline
 *      fallback rendered a blank unhydrated page.
 *   2. Its cache-first branch was the default, which swallowed Next.js RSC
 *      payloads — client-side navigations carry `mode: 'same-origin'`, not
 *      'navigate' — and served them forever without revalidation.
 *
 * Serving a cached page is still fine and useful: the board stamps its own fetch
 * time and renders "updated N minutes ago" from it, so a cached copy is visibly
 * self-labelling rather than silently wrong.
 */

// Bump on any change to caching behaviour. `activate` drops every `erwtn-` cache
// not named below, so a bump is also the remedy for a bad cache in the wild.
const VERSION = 'v2';
const ASSET_CACHE = `erwtn-assets-${VERSION}`;
const RUNTIME_CACHE = `erwtn-runtime-${VERSION}`;
const CURRENT_CACHES = [ASSET_CACHE, RUNTIME_CACHE];

/**
 * Precache only things that carry no live data and no build-specific references.
 * Note the absence of `/`, `/triage` and `/alternatives` — that absence is the
 * fix for the blank-page bug, not an oversight.
 */
const PRECACHE = ['/offline', '/icons/icon-192.png', '/icons/icon-96.png'];

/** Keep the runtime cache from growing without bound on a long-lived install. */
const RUNTIME_MAX_ENTRIES = 60;

/**
 * Content-addressed paths. Their URL changes whenever their bytes change, which
 * is precisely what makes cache-first safe for them and unsafe for everything
 * else.
 */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico'
  );
}

/** Requests that must always hit the network and must never be stored. */
function isNeverCacheable(url) {
  return (
    url.pathname.startsWith('/api/drive-times') ||
    url.pathname.startsWith('/api/alerts') ||
    url.pathname.startsWith('/api/cron') ||
    url.pathname.startsWith('/api/stripe')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSET_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('erwtn-') && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCacheable(url)) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else — navigations, RSC payloads, the wait-times API, the
  // manifest — is treated as live data.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone()).then(() => trimCache(cache));
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offline = await caches.match('/offline');
      if (offline) return offline;
    }

    // A failed RSC fetch must be an error, not an empty success. Returning a
    // fake 200 here would leave the router parsing nonsense; a 503 makes Next
    // fall back to a full page load, which recovers cleanly.
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'No connection. For urgent help call 911, or 811 for nurse advice.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/** Evict oldest-first once the runtime cache exceeds its cap. */
async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_MAX_ENTRIES) return;
  await Promise.all(
    keys.slice(0, keys.length - RUNTIME_MAX_ENTRIES).map((key) => cache.delete(key)),
  );
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
