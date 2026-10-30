import { strict as assert } from 'node:assert'
import { mock, test } from 'node:test'

const pipeline = mock.fn(() => {
  throw new Error('Redis must not be used with invalid cookie configuration')
})
mock.module(new URL('../src/redis.ts', import.meta.url).href, {
  exports: { getRedis: () => ({ pipeline }) },
})
mock.module(new URL('../src/processors/helpers.ts', import.meta.url).href, {
  exports: {
    getCaseStudyQuestionPoints: () => undefined,
    getChoicesQuestionPoints: () => undefined,
    getFreeTextQuestionPoints: () => undefined,
    getNumericalQuestionPoints: () => undefined,
    getSelectionQuestionPoints: () => undefined,
    updateLeaderboards: () => undefined,
    validateStudentResponse: () => undefined,
  },
})
const { processResponseMessage } = await import(
  '../src/processors/processor.js'
)

test('invalid cookie configuration fails before a response can become anonymous', async () => {
  const originalNamespace = process.env.KLICKER_COOKIE_NAMESPACE
  const originalLegacy = process.env.NEXT_PUBLIC_PREVIEW_ID
  try {
    for (const [namespace, legacy] of [
      ['runtime-a', 'preview-a'],
      ['INVALID', ''],
    ]) {
      process.env.KLICKER_COOKIE_NAMESPACE = namespace
      process.env.NEXT_PUBLIC_PREVIEW_ID = legacy
      const message = {
        messageId: 'synthetic-message',
        sessionId: 'synthetic-session',
        instanceId: 'synthetic-instance',
        response: { value: 'synthetic' },
        cookie: 'participant_token=synthetic',
        responseTimestamp: 0,
      } as Parameters<typeof processResponseMessage>[0]
      const context = {
        logger: { info() {}, error() {} },
      } as unknown as Parameters<typeof processResponseMessage>[1]
      await assert.rejects(processResponseMessage(message, context))
      assert.equal(pipeline.mock.callCount(), 0)
    }
  } finally {
    if (originalNamespace === undefined)
      delete process.env.KLICKER_COOKIE_NAMESPACE
    else process.env.KLICKER_COOKIE_NAMESPACE = originalNamespace
    if (originalLegacy === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ID
    else process.env.NEXT_PUBLIC_PREVIEW_ID = originalLegacy
  }
})
