import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createBlockExpiryGate, resetExpiryGate } from './blockExpiryGate'

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
})
