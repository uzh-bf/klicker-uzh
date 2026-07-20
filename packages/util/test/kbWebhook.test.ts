import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signKBIngestionWebhook } from '../src/kbWebhook.js'

describe('KB ingestion webhook signing', () => {
  it('signs the timestamp and exact raw request bytes', () => {
    const rawBody = Buffer.from('{"resourceId":"abc"}')

    expect(
      signKBIngestionWebhook({
        rawBody,
        secret: 'secret',
        timestamp: 1_721_488_400,
      })
    ).toEqual({
      'x-kb-timestamp': '1721488400',
      'x-kb-signature': createHmac('sha256', 'secret')
        .update(Buffer.concat([Buffer.from('1721488400.'), rawBody]))
        .digest('hex'),
    })
  })

  it('produces different signatures for equivalent JSON with different raw bytes', () => {
    const compactBody = Buffer.from('{"resourceId":"abc"}')
    const spacedBody = Buffer.from('{ "resourceId": "abc" }')

    expect(JSON.parse(compactBody.toString('utf8'))).toEqual(
      JSON.parse(spacedBody.toString('utf8'))
    )

    const compactSignature = signKBIngestionWebhook({
      rawBody: compactBody,
      secret: 'secret',
      timestamp: 1_721_488_400,
    })['x-kb-signature']
    const spacedSignature = signKBIngestionWebhook({
      rawBody: spacedBody,
      secret: 'secret',
      timestamp: 1_721_488_400,
    })['x-kb-signature']

    expect(compactSignature).not.toBe(spacedSignature)
  })
})
