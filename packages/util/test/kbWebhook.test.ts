import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signKBIngestionWebhook } from '../src/kbWebhook.js'

describe('KB ingestion webhook signing', () => {
  it('returns the canonical envelope headers and signs exact raw bytes', () => {
    const rawBody = Buffer.from('{"eventId":"event-id"}')

    expect(
      signKBIngestionWebhook({
        eventId: 'event-id',
        eventType: 'resource.processing_started',
        rawBody,
        secret: 'secret',
        timestamp: 1_721_488_400,
      })
    ).toEqual({
      'x-ingestion-event-id': 'event-id',
      'x-ingestion-event-type': 'resource.processing_started',
      'x-ingestion-timestamp': '1721488400',
      'x-ingestion-signature': createHmac('sha256', 'secret')
        .update(Buffer.concat([Buffer.from('1721488400.'), rawBody]))
        .digest('hex'),
    })
  })

  it('produces different signatures for equivalent JSON with different raw bytes', () => {
    const compactBody = Buffer.from('{"eventId":"event-id"}')
    const spacedBody = Buffer.from('{ "eventId": "event-id" }')

    expect(JSON.parse(compactBody.toString('utf8'))).toEqual(
      JSON.parse(spacedBody.toString('utf8'))
    )

    const compactSignature = signKBIngestionWebhook({
      eventId: 'event-id',
      eventType: 'resource.processing_started',
      rawBody: compactBody,
      secret: 'secret',
      timestamp: 1_721_488_400,
    })['x-ingestion-signature']
    const spacedSignature = signKBIngestionWebhook({
      eventId: 'event-id',
      eventType: 'resource.processing_started',
      rawBody: spacedBody,
      secret: 'secret',
      timestamp: 1_721_488_400,
    })['x-ingestion-signature']

    expect(compactSignature).not.toBe(spacedSignature)
  })
})
