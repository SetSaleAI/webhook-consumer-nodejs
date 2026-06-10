# webhook-consumer-nodejs

Minimal webhook handler built with [Hono](https://hono.dev/) and deployable to [Vercel](https://vercel.com).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/webhook` | Webhook receiver |

## Environment variables

| Variable | Description |
|----------|-------------|
| `SETSALE_WEBHOOK_SECRET` | Signing secret shown once when creating an endpoint in SetSale settings (`whsec_…`) |

Add it in the Vercel dashboard under **Project → Settings → Environment Variables**, or via `.env.local` for local dev.

## Webhook verification

Every incoming request is verified before processing:

1. `setsale-signature` header is parsed for `t` (Unix seconds) and `v1` (hex HMAC-SHA256).
2. The timestamp is checked to be within **5 minutes** of the server clock (replay protection).
3. The HMAC is recomputed over `` `${t}.${rawBody}` `` and compared in constant time via `crypto.subtle.verify`.

Requests that fail verification receive a `401` response immediately.

## Idempotency

The `setsale-event-id` header is stable across retries and replays. Store it in your database and skip processing if you've seen it before to handle at-least-once delivery safely.

## Adding event handlers

Extend the `switch` in `api/index.ts`:

```ts
case 'order.created':
  await handleOrderCreated(payload.data, eventId)
  break
```

## Local dev

```bash
npm install
npm run dev
```

## Deploy

```bash
npx vercel deploy
```

