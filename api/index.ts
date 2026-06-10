import { Hono } from 'hono'
import { handle } from 'hono/vercel'

export const config = { runtime: 'edge' }

const app = new Hono().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

/**
 * Main webhook endpoint.
 * Vercel delivers the raw request body — read it here and route by event type.
 */
app.post('/webhook', async (c) => {
  const payload = await c.req.json<{ event: string; data?: unknown }>()

  switch (payload.event) {
    case 'ping':
      return c.json({ received: true, event: 'ping' })

    default:
      console.log('unhandled event', payload.event, payload.data)
      return c.json({ received: true, event: payload.event })
  }
})

export default handle(app)
