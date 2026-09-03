import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMBED_INIT_MESSAGE_TYPE,
  EMBED_RESIZE_VERSION,
  isAllowedQuizAdvanceMessage,
  isEmbedInitMessage,
  isValidEmbedResizePayload,
  mergeEmbedCapabilities,
  QUIZ_ADVANCE_MESSAGE_TYPE,
  QUIZ_ADVANCE_VERSION,
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
    assert.equal(
      isEmbedInitMessage({
        type: EMBED_INIT_MESSAGE_TYPE,
        capabilities: { futureCapability: true },
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
        version: EMBED_RESIZE_VERSION,
        height: 480,
      }),
      true
    )
    assert.equal(isValidEmbedResizePayload({ version: 2, height: 480 }), false)
    assert.equal(
      isValidEmbedResizePayload({
        version: EMBED_RESIZE_VERSION,
        height: Number.POSITIVE_INFINITY,
      }),
      false
    )
  })

  it('accepts advance only when the current host action is available', () => {
    const message = {
      type: QUIZ_ADVANCE_MESSAGE_TYPE,
      payload: { version: QUIZ_ADVANCE_VERSION },
    }

    assert.equal(
      isAllowedQuizAdvanceMessage(message, {
        phase: 'feedback',
        canAdvance: true,
      }),
      true
    )
    assert.equal(
      isAllowedQuizAdvanceMessage(message, {
        phase: 'answering',
        canAdvance: false,
      }),
      false
    )
    assert.equal(
      isAllowedQuizAdvanceMessage(message, {
        phase: 'completed',
        canAdvance: true,
      }),
      false
    )
  })
})
