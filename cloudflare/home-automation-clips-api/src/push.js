import { buildPushHTTPRequest } from '@pushforge/builder';

function isAuthorized(request, env) {
  const secret = env.PUSH_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('Authorization');
  return header === `Bearer ${secret}`;
}

function parseSubscription(body) {
  if (!body || typeof body !== 'object') return null;
  const { endpoint, keys } = body;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function getVapidPublicKey(env) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY is not configured');
  return { public_key: publicKey };
}

export async function saveSubscription(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Invalid JSON body', status: 400 };
  }

  const subscription = parseSubscription(body);
  if (!subscription) return { error: 'Invalid push subscription payload', status: 400 };

  await env.DB.prepare(
    `
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `,
  )
    .bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth)
    .run();

  return { ok: true };
}

export async function sendPushNotifications(request, env) {
  if (!isAuthorized(request, env)) return { error: 'Unauthorized', status: 401 };

  const privateJwk = env.VAPID_PRIVATE_KEY;
  const adminContact = env.VAPID_SUBJECT;
  if (!privateJwk || !adminContact) {
    return { error: 'Push notifications are not configured on the server', status: 503 };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Invalid JSON body', status: 400 };
  }

  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Home Dashboard';
  const messageBody = typeof body.body === 'string' ? body.body : '';
  const url = typeof body.url === 'string' ? body.url : '/';
  const tag = typeof body.tag === 'string' ? body.tag : undefined;

  const { results: subscriptions } = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY id ASC',
  ).all();

  if (!subscriptions.length) return { sent: 0, failed: 0, removed: 0, message: 'No subscriptions registered' };

  let privateKey;
  try {
    privateKey = JSON.parse(privateJwk);
  } catch {
    return { error: 'VAPID_PRIVATE_KEY must be valid JWK JSON', status: 500 };
  }

  const payload = {
    title,
    body: messageBody,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    data: { url },
  };

  let sent = 0;
  let failed = 0;
  const deadEndpoints = [];

  await Promise.all(
    subscriptions.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        const { endpoint, headers, body: pushBody } = await buildPushHTTPRequest({
          privateJWK: privateKey,
          subscription,
          message: {
            payload,
            adminContact,
            options: { urgency: 'high', ttl: 86_400 },
          },
        });

        const response = await fetch(endpoint, { method: 'POST', headers, body: pushBody });
        if (response.status === 201 || response.status === 200) {
          sent += 1;
          return;
        }

        if (response.status === 404 || response.status === 410) {
          deadEndpoints.push(row.endpoint);
          return;
        }

        failed += 1;
        console.error(
          JSON.stringify({
            message: 'Push delivery failed',
            endpoint: row.endpoint,
            status: response.status,
          }),
        );
      } catch (error) {
        failed += 1;
        console.error(
          JSON.stringify({
            message: 'Push delivery error',
            endpoint: row.endpoint,
            error: String(error),
          }),
        );
      }
    }),
  );

  if (deadEndpoints.length) {
    const placeholders = deadEndpoints.map(() => '?').join(', ');
    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint IN (${placeholders})`)
      .bind(...deadEndpoints)
      .run();
  }

  return { sent, failed, removed: deadEndpoints.length, total: subscriptions.length };
}
