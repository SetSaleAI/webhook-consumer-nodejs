# webhook-consumer-nodejs

Minimal webhook handler built with [Hono](https://hono.dev/) and deployable to [Vercel](https://vercel.com).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/webhook` | Webhook receiver |

## Local dev

```bash
npm install
npm run dev
```

## Deploy

```bash
npx vercel deploy
```

## Adding event handlers

Extend the `switch` in `api/index.ts`:

```ts
case 'order.created':
  // handle order
  return c.json({ received: true, event: 'order.created' })
```
