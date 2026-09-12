import { createHmac } from 'node:crypto'

export function createKBIngestionWebhookSignature({
  rawBody,
  secret,
  timestamp,
}: {
  rawBody: Buffer
  secret: string
  timestamp: number | string
}) {
  const timestampHeader = String(timestamp)
  return createHmac('sha256', secret)
    .update(
      Buffer.concat([Buffer.from(`${timestampHeader}.`, 'utf8'), rawBody])
    )
    .digest('hex')
}

export function signKBIngestionWebhook({
  eventId,
  eventType,
  rawBody,
  secret,
  timestamp,
}: {
  eventId: string
  eventType: string
  rawBody: Buffer
  secret: string
  timestamp: number | string
}) {
  const timestampHeader = String(timestamp)

  return {
    'x-ingestion-event-id': eventId,
    'x-ingestion-event-type': eventType,
    'x-ingestion-timestamp': timestampHeader,
    'x-ingestion-signature': createKBIngestionWebhookSignature({
      rawBody,
      secret,
      timestamp: timestampHeader,
    }),
  }
}
