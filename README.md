# webhook-consumer-nodejs

Minimal SetSale webhook consumer built with [Hono](https://hono.dev/) for the [Vercel Edge Runtime](https://vercel.com).

The webhook entrypoint is implemented in [api/index.ts](/Users/jonathanwilke/development/setsale/webhook-consumer-nodejs/api/index.ts).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{ "status": "ok" }` |
| `POST` | `/api/webhook` | Verifies the SetSale signature, logs the event, and returns `{ "received": true }` |

`vercel.json` rewrites all incoming paths to `/api/index`, so these routes are served from the single Hono app in `api/index.ts`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `SETSALE_WEBHOOK_SECRET` | Raw SetSale webhook secret, including the `whsec_` prefix |

The current implementation uses the full secret string as the UTF-8 HMAC key. It is not base64-decoded before verification.

## Required webhook headers

The webhook handler reads these request headers:

| Header | Purpose |
|--------|---------|
| `setsale-signature` | Signature header in the format `t=<timestamp>,v1=<hex-hmac>` |
| `setsale-event-id` | Stable event identifier for idempotency |
| `setsale-event-type` | Event type logged for observability |

## Verification flow

Every incoming `POST /api/webhook` request is verified before any processing:

1. The raw request body is read before JSON parsing.
2. `setsale-signature` is parsed for `t` and `v1`.
3. The timestamp must be within 5 minutes of the current server time.
4. The signature is verified with HMAC-SHA256 over `` `${t}.${rawBody}` `` using `crypto.subtle.verify`.

If verification fails, the endpoint returns `401` with `{ "error": "invalid signature" }`.

## Current event handling

The current implementation explicitly handles `quote.created` events.

For that event type, it:

- parses the payload as a webhook envelope with `data.quote`
- logs the webhook type and event id
- logs the `quote` object in formatted JSON

All other event types are accepted but only logged as unhandled.

## Payload shape used today

The typed `quote.created` payload expects:

```ts
{
  id: string
  type: string
  apiVersion: string
  createdAt: string
  data: {
    quote: {
      id: string
      type: string
      status: string
      customer: {
        id: string
        name: string
        email: string
      }
      amount: number
      url: string
      createdAt: string
    }
  }
}
```

## Idempotency

The code reads `setsale-event-id` and documents it for deduplication, but it does not persist or enforce idempotency yet. To make retries safe, store that value in your database and skip already-processed events.

## Adding more handlers

Extend the `switch` in [api/index.ts](/Users/jonathanwilke/development/setsale/webhook-consumer-nodejs/api/index.ts):

```ts
case 'order.created':
  await handleOrderCreated(payload.data, eventId)
  break
```

Any 2xx response within 10 seconds acknowledges the delivery to SetSale, so long-running work should usually be offloaded.

## Local development

```bash
npm install
npm run dev
```

The `dev` script runs:

```bash
node --watch --experimental-strip-types api/index.ts
```

## Type checking

```bash
npm run typecheck
```

## Deploy

```bash
npx vercel deploy
```
