import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildChatbotRedirectParams,
  HANDOFF_TOPIC_LIMIT,
} from '@klicker-uzh/shared-components/src/utils/handoff'

describe('chatbot handoff redirect parameters', () => {
  it('keeps an allowed topic and source next to the embed flag', () => {
    const parameters = buildChatbotRedirectParams(
      { embed: 'true', q: 'What is duration?', src: 'askuzh' },
      true
    )

    assert.equal(parameters.get('embed'), 'true')
    assert.equal(parameters.get('q'), 'What is duration?')
    assert.equal(parameters.get('src'), 'askuzh')
  })

  it('drops topics over the cap, unknown sources, and foreign parameters', () => {
    const parameters = buildChatbotRedirectParams(
      {
        q: 'x'.repeat(HANDOFF_TOPIC_LIMIT + 1),
        src: 'somewhere-else',
        redirect_to: 'https://example.org',
      },
      false
    )

    assert.equal(parameters.toString(), '')
  })

  it('strips control characters from a topic instead of forwarding them', () => {
    const parameters = buildChatbotRedirectParams({ q: 'a\u0000b' }, true)

    assert.equal(parameters.get('q'), 'ab')
  })
})
