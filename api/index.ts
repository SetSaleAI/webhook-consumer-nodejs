import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { verifySetSaleWebhook } from '../lib/verify-webhook.js'

// Vercel Edge runtime — Web Crypto and low cold-start latency for webhook ACKs.
export const config = { runtime: 'edge' }

/** Standard SetSale webhook envelope. */
interface WebhookPayload<T = unknown> {
  id: string
  type: string
  apiVersion: string
  createdAt: string
  data: T
}

/** Payload shape for `quote.created` events. */
interface QuoteCreatedData {
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

// All routes are mounted under /api (see vercel.json rewrite to this file).
const app = new Hono().basePath('/api')

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/webhook', async (c) => {
  // Read the raw body BEFORE any JSON parsing — verification requires the
  // exact bytes SetSale sent.
  const rawBody = await c.req.text()

  const sigHeader = c.req.header('setsale-signature') ?? ''
  const eventId = c.req.header('setsale-event-id') ?? ''
  const eventType = c.req.header('setsale-event-type') ?? ''
  const secret = process.env.SETSALE_WEBHOOK_SECRET ?? ''

  const valid = await verifySetSaleWebhook(rawBody, sigHeader, secret)
  if (!valid) {
    return c.json({ error: 'invalid signature' }, 401)
  }

  const payload = JSON.parse(rawBody) as WebhookPayload

  // Route by event type. Use eventId for idempotency when adding persistence.
  switch (payload.type) {
    case 'quote.created': {
      const { quote } = (payload as WebhookPayload<QuoteCreatedData>).data
      console.log('[quote.created]', JSON.stringify(quote, null, 2))
      break
    }

    default:
      console.log('[webhook] unhandled type', payload.type, payload.data)
  }

  // Any 2xx response within 10 s acknowledges the delivery to SetSale.
  return c.json({ received: true })
})

export default handle(app)
