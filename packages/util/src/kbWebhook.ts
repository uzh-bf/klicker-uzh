import { createHmac } from 'node:crypto'

export function signKBIngestionWebhook({
  rawBody,
  secret,
  timestamp,
}: {
  rawBody: Buffer
  secret: string
  timestamp: number | string
}) {
  const timestampHeader = String(timestamp)
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestampHeader}.`, 'utf8'),
    rawBody,
  ])

  return {
    'x-kb-timestamp': timestampHeader,
    'x-kb-signature': createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex'),
  }
}
