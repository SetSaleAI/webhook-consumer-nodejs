/** Max age of a webhook timestamp before we reject it as a replay. */
export const TOLERANCE_SECONDS = 5 * 60

/**
 * Verify a SetSale webhook signature.
 *
 * SetSale signs the raw body with HMAC-SHA256. The `setsale-signature` header
 * carries the timestamp (`t`) and hex digest (`v1`) used for verification.
 */
export async function verifySetSaleWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Parse "t=<unix>,v1=<hex>" into key/value pairs.
  const fields = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const idx = part.indexOf('=')
      return [part.slice(0, idx), part.slice(idx + 1)]
    }),
  )

  const timestamp = Number(fields['t'])
  const signatureHex = fields['v1'] ?? ''

  if (!Number.isFinite(timestamp)) return false

  // Reject stale or far-future timestamps to limit replay windows.
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false

  // The secret is used as a UTF-8 string — not base64-decoded.
  const secretBytes = new TextEncoder().encode(secret)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  // Signed payload: "<timestamp>.<raw request body>"
  const message = new TextEncoder().encode(`${fields['t']}.${rawBody}`)
  const sigBytes = new Uint8Array(
    (signatureHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
  )

  return crypto.subtle.verify('HMAC', key, sigBytes, message)
}
