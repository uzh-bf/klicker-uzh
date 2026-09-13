import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBlockExpiryGate,
  createSubmissionScope,
  resetExpiryGate,
} from './blockExpiryGate'

describe('block expiry gate', () => {
  it('stays expired across same-identity rerenders', () => {
    let gate = createBlockExpiryGate('quiz-1:execution-0')
    gate.markExpired()

    // the parent rerenders with a newly allocated instances array for the
    // same block execution — this must not reset the terminal state
    gate = resetExpiryGate(gate, 'quiz-1:execution-0')

    assert.equal(gate.isExpired(), true)
  })

  it('resets only for a genuinely new block execution', () => {
    let gate = createBlockExpiryGate('quiz-1:execution-0')
    gate.markExpired()

    gate = resetExpiryGate(gate, 'quiz-1:execution-1')

    assert.equal(gate.isExpired(), false)
    assert.equal(gate.identity, 'quiz-1:execution-1')
  })

  it('lets a captured gate keep reporting expiry after the ref moved on', () => {
    const oldGate = createBlockExpiryGate('quiz-1:execution-0')
    oldGate.markExpired()

    // a new execution swaps the current gate; async work that captured the
    // old gate still observes the expired terminal state
    const currentGate = resetExpiryGate(oldGate, 'quiz-1:execution-1')

    assert.equal(oldGate.isExpired(), true)
    assert.equal(currentGate.isExpired(), false)
    assert.notEqual(oldGate, currentGate)
  })

  it('starts unexpired for a fresh identity', () => {
    assert.equal(createBlockExpiryGate('quiz-1:execution-0').isExpired(), false)
  })

  it('marks an unexpired captured scope stale when the execution changes', () => {
    // execution 0 installs its gate; a submission captures a scope
    let currentIdentity = 'quiz-1:execution-0'
    let currentGate = createBlockExpiryGate(currentIdentity)
    const scope = createSubmissionScope(currentIdentity, currentGate)
    assert.equal(scope.canCommitUi(currentIdentity), true)

    // execution 1 replaces the current identity and installs a fresh gate
    currentIdentity = 'quiz-1:execution-1'
    currentGate = resetExpiryGate(currentGate, currentIdentity)

    // the old submission never expired, but its execution is no longer
    // current: it must not commit UI state into the new execution
    assert.equal(scope.canCommitUi(currentIdentity), false)
    assert.equal(currentGate.isExpired(), false)
  })

  it('keeps current-execution expiry cleanup committable', () => {
    let currentIdentity = 'quiz-1:execution-0'
    let currentGate = createBlockExpiryGate(currentIdentity)
    const expiryScope = createSubmissionScope(currentIdentity, currentGate)

    // expiry marks the gate and the scope stays current for its cleanup:
    // the cleanup authority is currency, not the expired flag
    currentGate.markExpired()
    assert.equal(expiryScope.isCurrent(currentIdentity), true)
    assert.equal(expiryScope.canCommitUi(currentIdentity), false)

    // ...but the same cleanup becomes stale once the execution changes
    currentIdentity = 'quiz-1:execution-1'
    currentGate = resetExpiryGate(currentGate, currentIdentity)
    assert.equal(expiryScope.canCommitUi(currentIdentity), false)
  })
})
