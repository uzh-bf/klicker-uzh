import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMBED_INIT_MESSAGE_TYPE,
  EMBED_PROTOCOL_VERSION,
  isEmbedInitMessage,
  isValidEmbedResizePayload,
  mergeEmbedCapabilities,
} from './embed'

describe('embed protocol', () => {
  it('accepts a bare initialization message', () => {
    assert.equal(isEmbedInitMessage({ type: EMBED_INIT_MESSAGE_TYPE }), true)
  })

  it('rejects malformed capability values', () => {
    assert.equal(
      isEmbedInitMessage({
        type: EMBED_INIT_MESSAGE_TYPE,
        capabilities: { resize: 'true' },
      }),
      false
    )
    assert.equal(isEmbedInitMessage({ type: 'other' }), false)
  })

  it('does not revoke a capability on a repeated initialization', () => {
    assert.deepEqual(
      mergeEmbedCapabilities({ resize: true }, { resize: false }),
      { resize: true, hostNavigation: false }
    )
  })

  it('validates resize payload version and bounds', () => {
    assert.equal(
      isValidEmbedResizePayload({
        version: EMBED_PROTOCOL_VERSION,
        height: 480,
      }),
      true
    )
    assert.equal(isValidEmbedResizePayload({ version: 2, height: 480 }), false)
    assert.equal(
      isValidEmbedResizePayload({
        version: EMBED_PROTOCOL_VERSION,
        height: Number.POSITIVE_INFINITY,
      }),
      false
    )
  })
})
