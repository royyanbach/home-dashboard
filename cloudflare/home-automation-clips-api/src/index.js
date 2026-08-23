import { connect } from 'cloudflare:sockets';
import { getVapidPublicKey, saveSubscription, sendPushNotifications } from './push.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const encoder = new TextEncoder();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function parsePositiveInteger(value, fallback) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function mqttString(value) {
  const bytes = encoder.encode(value);
  if (bytes.length > 65_535) throw new Error('MQTT string is too long');
  return concatBytes(Uint8Array.of(bytes.length >> 8, bytes.length & 0xff), bytes);
}

function remainingLength(value) {
  const bytes = [];
  do {
    let byte = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) byte |= 0x80;
    bytes.push(byte);
  } while (value > 0);
  return Uint8Array.from(bytes);
}

function mqttPacket(header, body) {
  return concatBytes(Uint8Array.of(header), remainingLength(body.length), body);
}

async function readExactly(reader, state, length) {
  while (state.bytes.length < length) {
    const { done, value } = await reader.read();
    if (done) throw new Error('MQTT broker closed the connection');
    state.bytes = concatBytes(state.bytes, value);
  }
  const result = state.bytes.slice(0, length);
  state.bytes = state.bytes.slice(length);
  return result;
}

async function readMqttPacket(reader, state) {
  const header = (await readExactly(reader, state, 1))[0];
  let length = 0;
  let multiplier = 1;
  let byte;
  do {
    byte = (await readExactly(reader, state, 1))[0];
    length += (byte & 0x7f) * multiplier;
    multiplier *= 128;
    if (multiplier > 128 ** 4) throw new Error('Invalid MQTT remaining length');
  } while (byte & 0x80);
  return { type: header >> 4, body: await readExactly(reader, state, length) };
}

async function publishMqtt(env, message) {
  const host = env.MQTT_HOST;
  const topic = env.MQTT_TOPIC;
  if (!host || !topic) throw new Error('MQTT_HOST and MQTT_TOPIC must be configured');

  const tls = env.MQTT_TLS !== 'false';
  const port = Number(env.MQTT_PORT ?? (tls ? 8883 : 1883));
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error('MQTT_PORT must be a valid port number');
  if (env.MQTT_PASSWORD && !env.MQTT_USERNAME)
    throw new Error('MQTT_USERNAME is required when MQTT_PASSWORD is set');

  const socket = connect({ hostname: host, port }, { secureTransport: tls ? 'on' : 'off' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const state = { bytes: new Uint8Array() };

  try {
    let flags = 0x02; // MQTT 3.1.1 clean session
    if (env.MQTT_USERNAME) flags |= 0x80;
    if (env.MQTT_PASSWORD) flags |= 0x40;
    const connectBody = concatBytes(
      mqttString('MQTT'),
      Uint8Array.of(0x04, flags, 0x00, 0x1e),
      mqttString(`home-automation-clips-${crypto.randomUUID()}`),
      ...(env.MQTT_USERNAME ? [mqttString(env.MQTT_USERNAME)] : []),
      ...(env.MQTT_PASSWORD ? [mqttString(env.MQTT_PASSWORD)] : []),
    );
    await writer.write(mqttPacket(0x10, connectBody));
    const connack = await readMqttPacket(reader, state);
    if (connack.type !== 2 || connack.body.length !== 2 || connack.body[1] !== 0) {
      throw new Error(`MQTT connection refused (code ${connack.body[1] ?? 'unknown'})`);
    }

    const publishBody = concatBytes(
      mqttString(topic),
      Uint8Array.of(0x00, 0x01),
      encoder.encode(JSON.stringify(message)),
    );
    await writer.write(mqttPacket(0x32, publishBody)); // QoS 1
    const puback = await readMqttPacket(reader, state);
    if (
      puback.type !== 4 ||
      puback.body.length !== 2 ||
      puback.body[0] !== 0 ||
      puback.body[1] !== 1
    ) {
      throw new Error('MQTT broker did not acknowledge the message');
    }

    await writer.write(Uint8Array.of(0xe0, 0x00)); // DISCONNECT
  } finally {
    try {
      await writer.close();
    } catch {
      /* The socket is closed below. */
    }
    socket.close();
    reader.releaseLock();
    writer.releaseLock();
  }
}

async function handleListClips(request, env, url) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 });

  const page = parsePositiveInteger(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveInteger(url.searchParams.get('page_size'), DEFAULT_PAGE_SIZE);
  if (
    !page ||
    !pageSize ||
    pageSize > MAX_PAGE_SIZE ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / pageSize)
  ) {
    return json(
      { error: 'page must be positive; page_size must be between 1 and 100' },
      { status: 400 },
    );
  }

  try {
    const offset = (page - 1) * pageSize;
    const [countQuery, clipsQuery] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS total FROM "home-automation-clips"'),
      env.DB.prepare(
        `
          SELECT id, file_name, created_at
          FROM "home-automation-clips"
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?
        `,
      ).bind(pageSize, offset),
    ]);
    const totalItems = countQuery.results[0].total;
    const totalPages = Math.ceil(totalItems / pageSize);

    const response = {
      items: clipsQuery.results,
      pagination: {
        page,
        page_size: pageSize,
        total_items: totalItems,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        previous_page: page > 1 ? page - 1 : null,
      },
    };
    if (page === 1) {
      await publishMqtt(env, {
        event: 'latest_cam_snapshot_requested',
        requested_at: new Date().toISOString(),
      });
    }
    return json(response);
  } catch (error) {
    console.error(JSON.stringify({ message: 'Failed to list clips', error: String(error) }));
    return json({ error: 'Unable to list clips' }, { status: 500 });
  }
}

async function handlePushRoute(request, env, path) {
  if (path === '/push/vapid-public-key') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 });
    try {
      return json(await getVapidPublicKey(env));
    } catch (error) {
      return json({ error: String(error) }, { status: 503 });
    }
  }

  if (path === '/push/subscribe') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
    try {
      const result = await saveSubscription(request, env);
      if (result.error) return json({ error: result.error }, { status: result.status ?? 400 });
      return json(result);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Failed to save push subscription', error: String(error) }));
      return json({ error: 'Unable to save push subscription' }, { status: 500 });
    }
  }

  if (path === '/push/send') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
    try {
      const result = await sendPushNotifications(request, env);
      if (result.error) return json({ error: result.error }, { status: result.status ?? 400 });
      return json(result);
    } catch (error) {
      console.error(JSON.stringify({ message: 'Failed to send push notifications', error: String(error) }));
      return json({ error: 'Unable to send push notifications' }, { status: 500 });
    }
  }

  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    const pushResponse = await handlePushRoute(request, env, path);
    if (pushResponse) return pushResponse;

    if (path === '/') return handleListClips(request, env, url);

    return json({ error: 'Not found' }, { status: 404 });
  },
};
