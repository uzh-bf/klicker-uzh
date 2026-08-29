import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  probeSemanticEvaluatorStub,
  semanticEvaluatorStubUrls,
} from './semanticEvaluatorStubUrl.js'

describe('semantic evaluator stub URL', () => {
  it('accepts the exact loopback evaluator endpoint', () => {
    const urls = semanticEvaluatorStubUrls('http://127.0.0.1:7099/evaluate')

    assert.equal(urls.evaluatorUrl.href, 'http://127.0.0.1:7099/evaluate')
    assert.equal(urls.healthUrl.href, 'http://127.0.0.1:7099/healthz')
  })

  for (const unsafeUrl of [
    'https://127.0.0.1:7099/evaluate',
    'http://127.0.0.1/evaluate',
    'http://localhost:7099/evaluate',
    'http://127.0.0.1:7099/other',
    'http://user:password@127.0.0.1:7099/evaluate',
    'http://127.0.0.1:7099/evaluate?target=external',
    'http://127.0.0.1:7099/evaluate#external',
    'https://example.com/evaluate',
  ]) {
    it(`rejects ${unsafeUrl}`, () => {
      assert.throws(() => semanticEvaluatorStubUrls(unsafeUrl))
    })
  }

  it('rejects an unsafe URL before probing it', async () => {
    let probeCalls = 0

    await assert.rejects(() =>
      probeSemanticEvaluatorStub('https://example.com/evaluate', {
        probe: async () => {
          probeCalls += 1
          return { ok: true }
        },
      })
    )

    assert.equal(probeCalls, 0)
  })

  it('sends the configured bearer token with the health probe', async () => {
    let authorization: string | undefined

    const result = await probeSemanticEvaluatorStub(
      'http://127.0.0.1:7099/evaluate',
      {
        token: 'synthetic-evaluator-token',
        probe: async (_url, init) => {
          authorization = init?.headers?.authorization
          return { ok: true }
        },
      }
    )

    assert.equal(result.running, true)
    assert.equal(authorization, 'Bearer synthetic-evaluator-token')
  })
})
