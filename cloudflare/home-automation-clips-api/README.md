# Home automation clips API

Public, read-only API for the existing D1 `home-automation-clips` table, plus push notification endpoints for the Home Dashboard PWA.

## Deploy

```sh
npm run deploy
```

The D1 binding in `wrangler.jsonc` is already configured for the existing
`home-automation` database.

## Use

### List clips

```text
GET https://YOUR_WORKER.workers.dev/?page=1&page_size=20
```

- `page` defaults to `1` and must be positive.
- `page_size` defaults to `20` and supports `1` through `100`.
- Rows are ordered by `created_at` descending, then `id` descending.

Example response:

```json
{
  "items": [
    {
      "id": 42,
      "file_name": "clips/front-door/event-123.mp4",
      "created_at": "2026-08-23T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 42,
    "total_pages": 3,
    "next_page": 2,
    "previous_page": null
  }
}
```

### Push notifications

Create the subscriptions table once:

```sh
npx wrangler d1 execute home-automation --remote --file=migrations/0001_push_subscriptions.sql
```

Generate VAPID keys and configure the worker:

```sh
npx @pushforge/builder vapid
```

1. Put the **public key** in `wrangler.jsonc` as `VAPID_PUBLIC_KEY`.
2. Set the **private JWK JSON** as an encrypted secret:

   ```sh
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```

3. Set a bearer token for the send endpoint:

   ```sh
   npx wrangler secret put PUSH_API_SECRET
   ```

4. Update `VAPID_SUBJECT` in `wrangler.jsonc` to a `mailto:` or `https:` contact URI.

#### Register a device (PWA)

The dashboard PWA calls this automatically after the user grants notification permission.

```text
POST https://YOUR_WORKER.workers.dev/push/subscribe
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

#### Send a notification

```text
POST https://YOUR_WORKER.workers.dev/push/send
Authorization: Bearer YOUR_PUSH_API_SECRET
Content-Type: application/json

{
  "title": "Motion detected",
  "body": "Front porch camera saw activity.",
  "url": "/",
  "tag": "front-porch-motion"
}
```

Response:

```json
{
  "sent": 1,
  "failed": 0,
  "removed": 0,
  "total": 1
}
```

#### Public VAPID key

```text
GET https://YOUR_WORKER.workers.dev/push/vapid-public-key
```

## MQTT on page 1

Every successful request for `page=1` publishes the same page data to MQTT at
QoS 1. In Cloudflare Dashboard, open this Worker → **Settings** → **Variables
and Secrets**, then set these variables:

| Variable        | Required | Example                                                |
| --------------- | -------- | ------------------------------------------------------ |
| `MQTT_HOST`     | Yes      | `mqtt.example.com`                                     |
| `MQTT_PORT`     | No       | `8883` (defaults to `8883` with TLS, otherwise `1883`) |
| `MQTT_TLS`      | No       | `true` (default); use `false` for plaintext MQTT       |
| `MQTT_TOPIC`    | Yes      | `home/automation/clips`                                |
| `MQTT_USERNAME` | No       | `clips-api`                                            |
| `MQTT_PASSWORD` | No       | Set as an encrypted secret                             |

The JSON message contains `event`, `published_at`, `items`, and `pagination`.
If MQTT publishing fails, the page-1 request returns an error instead of
silently dropping the message.

`npm run deploy` uses `--keep-vars`, so dashboard-set variables and secrets are
preserved on future deployments.
