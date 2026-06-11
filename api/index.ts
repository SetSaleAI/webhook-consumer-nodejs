import { Hono } from 'hono'
import { handle } from 'hono/vercel'

export const config = { runtime: 'edge' }

const TOLERANCE_SECONDS = 5 * 60

async function verifySetSaleWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const fields = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const idx = part.indexOf('=')
      return [part.slice(0, idx), part.slice(idx + 1)]
    }),
  )

  const timestamp = Number(fields['t'])
  const signatureHex = fields['v1'] ?? ''

  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false

  const secretBytes = new TextEncoder().encode(secret)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const message = new TextEncoder().encode(`${fields['t']}.${rawBody}`)
  const sigBytes = new Uint8Array(
    (signatureHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
  )

  return crypto.subtle.verify('HMAC', key, sigBytes, message)
}

interface WebhookPayload<T = unknown> {
  id: string
  type: string
  apiVersion: string
  createdAt: string
  data: T
}

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
