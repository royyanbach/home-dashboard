import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const clipsApiUrl = __CLIPS_API_URL__;
const clipsHost = __CLIPS_HOST__;

if (clipsApiUrl) {
  registerRoute(
    ({ url }) => url.href.startsWith(clipsApiUrl),
    new NetworkFirst({
      cacheName: 'clips-api',
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 60 * 60,
        }),
      ],
    }),
  );
}

if (clipsHost) {
  registerRoute(
    ({ url }) =>
      url.href.startsWith(clipsHost) && /\.(?:jpg|jpeg|png|mp4)$/i.test(url.pathname),
    new NetworkFirst({
      cacheName: 'clips-media',
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24,
        }),
      ],
    }),
  );
}

function toAbsoluteUrl(value) {
  if (!value || typeof value !== 'string') return undefined;
  try {
    return new URL(value, self.location.origin).href;
  } catch {
    return undefined;
  }
}

function toNotificationImageUrl(value) {
  const absolute = toAbsoluteUrl(value);
  return absolute?.startsWith('https://') ? absolute : undefined;
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: 'Home Dashboard',
    body: 'You have a new update.',
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Home Dashboard', {
      body: data.body,
      icon: toAbsoluteUrl(data.icon ?? '/pwa-192x192.png'),
      badge: toAbsoluteUrl(data.badge ?? '/pwa-192x192.png'),
      image: toNotificationImageUrl(data.image),
      tag: data.tag,
      data: data.data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url ?? '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
