import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSemanticEvaluatorStubAuthorized,
  requiresSemanticEvaluatorStubToken,
} from './semanticEvaluatorStubAuth.mjs'

describe('semantic evaluator stub authentication', () => {
  it('allows an unauthenticated loopback-only stub', () => {
    assert.equal(requiresSemanticEvaluatorStubToken('127.0.0.1'), false)
    assert.equal(isSemanticEvaluatorStubAuthorized(undefined, undefined), true)
  })

  it('requires authentication for a Docker-facing listener', () => {
    assert.equal(requiresSemanticEvaluatorStubToken('0.0.0.0'), true)
  })

  it('rejects missing and incorrect bearer tokens', () => {
    assert.equal(
      isSemanticEvaluatorStubAuthorized(undefined, 'synthetic-token'),
      false
    )
    assert.equal(
      isSemanticEvaluatorStubAuthorized(
        'Bearer incorrect-token',
        'synthetic-token'
      ),
      false
    )
  })

  it('accepts the exact configured bearer token', () => {
    assert.equal(
      isSemanticEvaluatorStubAuthorized(
        'Bearer synthetic-token',
        'synthetic-token'
      ),
      true
    )
  })
})
