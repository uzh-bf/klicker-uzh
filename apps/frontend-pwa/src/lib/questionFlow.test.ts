import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBlockExpiryGate,
  createSubmissionScope,
  resetExpiryGate,
} from './blockExpiryGate'

/**
 * Flow harness for the QuestionArea submission/expiry wiring.
 *
 * The harness mirrors the component's handler structure — identity ref,
 * expiry gate, execution-owned pending slot, submission scopes, and the
 * storage-await recheck — with controllable deferred promises for the
 * network and the local persistence layer. It verifies the placement of the
 * gate predicates in the actual handler ordering; it is not a rendered
 * component test.
 */

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let settled = false
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = (value: T) => {
      if (settled) return
      settled = true
      res(value)
    }
  })
  return { promise, resolve }
}

function createHarness() {
  // state mirrored from the component
  let currentIdentity = 'quiz-1:execution-0'
  let gate = createBlockExpiryGate(currentIdentity)
  let inFlight: { identity: string; promise: Promise<boolean> } | null = null
  let submitting = false
  let remainingQuestions: number[] = [0, 1, 2]
  let activeInstance = 0
  let submittedAt: number | null = null
  let confetti = false

  // controllable externals: each request carries its own deferred so tests
  // can resolve completions independently
  const requestDeferreds: Deferred<boolean>[] = []
  // persistence is instant unless a test defers it
  let storageDeferred = createDeferred<void>()
  storageDeferred.resolve()
  const networkSendsByExecution: string[] = []

  // mirrors the identity-change effect, including detaching a pending
  // submission from a superseded execution and releasing the busy state
  function setExecution(identity: string) {
    currentIdentity = identity
    gate = resetExpiryGate(gate, identity)
    if (inFlight && inFlight.identity !== identity) {
      inFlight = null
      submitting = false
    }
    // the new execution's initialization supplies its own stack state
    remainingQuestions = [0, 1]
    activeInstance = 0
    submittedAt = null
    confetti = false
  }

  // mirrors the component's answerQuestion (free-text branch via
  // submitAndRecord): each request carries its own deferred result, the
  // network send is deferred-controllable, persistence is instant, and the
  // submitted-at write is execution-guarded
  async function answerQuestion(): Promise<boolean> {
    const answerScope = createSubmissionScope(currentIdentity, gate)
    networkSendsByExecution.push(currentIdentity)
    const ownDeferred = createDeferred<boolean>()
    requestDeferreds.push(ownDeferred)
    const recorded = await ownDeferred.promise
    await Promise.resolve() // persistence microtask
    if (recorded) {
      if (answerScope.canCommitUi(currentIdentity)) {
        submittedAt = 1000
      }
      return true
    }
    return false
  }

  // mirrors the component's onSubmit
  async function onSubmit(): Promise<void> {
    const pending = inFlight
    if ((pending && pending.identity === currentIdentity) || gate.isExpired()) {
      return
    }
    submitting = true
    const submissionScope = createSubmissionScope(currentIdentity, gate)

    const runSubmission = async (): Promise<boolean> => {
      const success = await answerQuestion()
      if (!success) return false
      if (!submissionScope.canCommitUi(currentIdentity)) return true
      remainingQuestions = remainingQuestions.filter((q) => q !== 0)
      return true
    }

    const submission = runSubmission().finally(() => {
      if (inFlight?.promise === submission) {
        inFlight = null
        submitting = false
      }
    })
    inFlight = { identity: currentIdentity, promise: submission }
    await submission
  }

  // mirrors the component's onExpire
  async function onExpire(): Promise<void> {
    const expiryScope = createSubmissionScope(currentIdentity, gate)
    gate.markExpired()

    const inFlightForExecution =
      inFlight?.identity === expiryScope.identity ? inFlight : null
    try {
      if (inFlightForExecution) {
        const submitted = await inFlightForExecution.promise
        if (!submitted) {
          // error toast — no state effect in the harness
        }
      } else {
        const submitted = await answerQuestion()
        if (!submitted) {
          // error toast — no state effect in the harness
        }
      }
    } catch {
      // error toast — no state effect in the harness
    }

    if (!expiryScope.isCurrent(currentIdentity)) return

    // local persistence for the remaining answers (defer-controllable)
    await storageDeferred.promise

    // currency must be rechecked after the storage await
    if (!expiryScope.isCurrent(currentIdentity)) return

    remainingQuestions = []
    activeInstance = -1
    confetti = true
  }

  return {
    get state() {
      return {
        currentIdentity,
        inFlight,
        submitting,
        remainingQuestions,
        activeInstance,
        submittedAt,
        confetti,
        // mirrors canSubmit={!!studentResponse.valid && !submitting} with a
        // valid answer supplied
        canSubmit: !submitting,
      }
    },
    get networkSendsByExecution() {
      return networkSendsByExecution
    },
    resolveNetwork(value: boolean) {
      // resolve every still-pending request (idempotent deferreds make this
      // safe when tests only need "everything completes")
      for (const request of requestDeferreds) {
        request.resolve(value)
      }
    },
    resolveRequest(index: number, value: boolean) {
      requestDeferreds[index]?.resolve(value)
    },
    deferStorage() {
      storageDeferred = createDeferred<void>()
    },
    resolveStorage() {
      storageDeferred.resolve()
    },
    setExecution,
    onSubmit,
    onExpire,
  }
}

describe('question submission/expiry flow', () => {
  it('records and advances a current manual submission', async () => {
    const harness = createHarness()
    const done = harness.onSubmit()
    harness.resolveNetwork(true)
    await done

    assert.equal(harness.state.inFlight, null)
    assert.equal(harness.state.submitting, false)
    assert.deepEqual(harness.state.remainingQuestions, [1, 2])
    assert.equal(harness.state.submittedAt, 1000)
    assert.deepEqual(harness.networkSendsByExecution, ['quiz-1:execution-0'])
  })

  it('same-execution expiry awaits the manual submission without resending', async () => {
    const harness = createHarness()
    const submission = harness.onSubmit()
    harness.deferStorage()
    const expiry = harness.onExpire()

    // one network send only: expiry reused the in-flight submission
    assert.deepEqual(harness.networkSendsByExecution.length, 1)

    harness.resolveNetwork(true)
    harness.resolveStorage()
    await Promise.all([submission, expiry])

    assert.deepEqual(harness.state.remainingQuestions, [])
    assert.equal(harness.state.activeInstance, -1)
  })

  it('a stale manual completion cannot advance the new execution', async () => {
    const harness = createHarness()
    const submission = harness.onSubmit()

    // the component receives a new execution while the old submission is
    // pending
    harness.setExecution('quiz-1:execution-1')
    assert.deepEqual(harness.state.remainingQuestions, [0, 1])

    harness.resolveNetwork(true)
    await submission
    await new Promise((resolve) => setTimeout(resolve, 0))

    // the stale completion must not remove questions or stamp the
    // submitted-at state of the new execution
    assert.deepEqual(harness.state.remainingQuestions, [0, 1])
    assert.equal(harness.state.submittedAt, null)
  })

  it('an execution change during expiry storage keeps the new stack state', async () => {
    const harness = createHarness()
    const expiry = harness.onExpire()

    // let the expiry pass its answer and the pre-storage currency check so
    // it suspends on the storage await, then swap the execution while the
    // storage operations are still pending
    harness.deferStorage()
    harness.resolveNetwork(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    harness.setExecution('quiz-1:execution-1')
    harness.resolveStorage()
    await expiry
    await new Promise((resolve) => setTimeout(resolve, 0))

    // the stale cleanup must not empty the new execution's stack — the
    // post-storage currency recheck returns before the terminal writes
    assert.deepEqual(harness.state.remainingQuestions, [0, 1])
    assert.equal(harness.state.activeInstance, 0)
    assert.equal(harness.state.confetti, false)
  })

  it("a superseded pending submission neither blocks nor substitutes for the new execution's answer", async () => {
    const harness = createHarness()
    const oldSubmission = harness.onSubmit()

    // execution changes while execution 0's manual submission is pending
    harness.setExecution('quiz-1:execution-1')

    // execution 1 expires with a valid answer: the old pending submission
    // must not block admission nor stand in for the answer
    const expiry = harness.onExpire()

    // execution 1 sent its own answer
    assert.deepEqual(harness.networkSendsByExecution, [
      'quiz-1:execution-0',
      'quiz-1:execution-1',
    ])

    // both submissions resolve successfully; execution 1's cleanup completes
    harness.resolveNetwork(true)
    await Promise.all([oldSubmission, expiry])
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(harness.state.remainingQuestions, [])
  })

  it('releases the submit control when a superseded submission is pending', async () => {
    const harness = createHarness()
    const oldSubmission = harness.onSubmit()
    assert.equal(harness.state.submitting, true)

    // the same mounted component receives a new execution while submission
    // A is pending: the submit control must become available again
    harness.setExecution('quiz-1:execution-1')
    assert.equal(
      harness.state.canSubmit,
      true,
      'the new execution must not inherit the disabled submit button'
    )
    assert.equal(harness.state.inFlight, null)

    // the new execution submits its own answer while A is still pending
    const newSubmission = harness.onSubmit()
    assert.deepEqual(harness.networkSendsByExecution, [
      'quiz-1:execution-0',
      'quiz-1:execution-1',
    ])

    // resolving A alone must not release B's busy indication: A and B carry
    // independent deferreds, so A's completion leaves B still pending
    harness.resolveRequest(0, true)
    await oldSubmission
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(
      harness.state.canSubmit,
      false,
      'B must stay busy while its own request is pending'
    )
    assert.deepEqual(harness.state.remainingQuestions, [0, 1])

    // resolving B lets it advance and release the control
    harness.resolveRequest(1, true)
    await newSubmission
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(harness.state.remainingQuestions, [1])
    assert.equal(harness.state.submittedAt, 1000)
    assert.equal(harness.state.submitting, false)
  })
})
