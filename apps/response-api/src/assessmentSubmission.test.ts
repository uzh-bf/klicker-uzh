import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dispatchAssessmentSubmission } from './assessmentSubmission.js'

describe('assessment submission dispatch', () => {
  it('is accepted only after the enqueue resolves', async () => {
    let resolveEnqueue: (() => void) | undefined
    let outcome: string | undefined
    const enqueue = new Promise<void>((resolve) => {
      resolveEnqueue = resolve
    })

    const dispatch = dispatchAssessmentSubmission({
      enqueue: () => enqueue,
      auditFailure: async () => undefined,
    }).then((result) => {
      outcome = result
    })

    await Promise.resolve()
    assert.equal(outcome, undefined)

    resolveEnqueue?.()
    await dispatch
    assert.equal(outcome, 'accepted')
  })

  it('is unconfirmed when the enqueue rejects', async () => {
    const queueError = new Error('synthetic enqueue failure')
    const auditErrors: unknown[] = []
    let enqueueCalls = 0

    const outcome = await dispatchAssessmentSubmission({
      enqueue: async () => {
        enqueueCalls++
        throw queueError
      },
      auditFailure: async (error) => {
        auditErrors.push(error)
      },
    })
    await new Promise<void>((resolve) => setImmediate(resolve))

    assert.equal(outcome, 'unconfirmed')
    assert.equal(enqueueCalls, 1)
    assert.deepEqual(auditErrors, [queueError])
  })

  it('stays unconfirmed when failure audit rejects', async () => {
    const outcome = await dispatchAssessmentSubmission({
      enqueue: async () => {
        throw new Error('synthetic enqueue failure')
      },
      auditFailure: async () => {
        throw new Error('synthetic audit failure')
      },
    })
    await new Promise<void>((resolve) => setImmediate(resolve))

    assert.equal(outcome, 'unconfirmed')
  })

  it('does not wait indefinitely for the failure audit', async () => {
    const outcome = await dispatchAssessmentSubmission({
      enqueue: async () => {
        throw new Error('synthetic enqueue failure')
      },
      auditFailure: () => new Promise(() => undefined),
    })

    assert.equal(outcome, 'unconfirmed')
  })
})
