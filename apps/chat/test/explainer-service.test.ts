import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHOW_EXPLANATION_TOOL_NAME } from '@/src/lib/explanations'
import {
  explanationAttemptsLeft,
  failedExplanationAttempts,
  validateExplanation,
} from '@/src/services/explainerService'

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('explainer service client', () => {
  beforeEach(() => {
    vi.stubEnv('EXPLAINER_SERVICE_URL', 'http://explainer.test/')
    vi.stubEnv('EXPLAINER_SERVICE_TOKEN', 'synthetic-token')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('passes valid content through and reports errors for a repair', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true, errors: [] }))
    const content = { format: 'explainer/1' }
    expect(await validateExplanation(content)).toEqual({
      kind: 'explanation',
      content,
    })

    const fetchSpy = respond(200, {
      ok: false,
      errors: ['steps.a.text: 80 words, more than 70'],
    })
    vi.stubGlobal('fetch', fetchSpy)
    expect(await validateExplanation(content)).toEqual({
      kind: 'explanation-invalid',
      errors: ['steps.a.text: 80 words, more than 70'],
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://explainer.test/explainer/v1/validate',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer synthetic-token',
        }),
      })
    )
  })

  it('treats an oversized body as a repairable error and a failing service as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      respond(413, { code: 'EXPLAINER_REQUEST_TOO_LARGE' })
    )
    expect(await validateExplanation({})).toMatchObject({
      kind: 'explanation-invalid',
    })
    vi.stubGlobal('fetch', respond(503, {}))
    expect(await validateExplanation({})).toEqual({
      kind: 'explanation-unavailable',
    })
  })
})

describe('explanation attempts', () => {
  const invalid = {
    type: 'tool-result',
    toolName: SHOW_EXPLANATION_TOOL_NAME,
    output: { kind: 'explanation-invalid', errors: ['x'] },
  }
  const malformed = { type: 'tool-error', toolName: SHOW_EXPLANATION_TOOL_NAME }
  const other = { type: 'tool-error', toolName: 'calculate' }

  it('counts rejected and malformed calls, and withdraws the tool after three', () => {
    const steps = [{ content: [invalid] }, { content: [malformed, other] }]
    expect(failedExplanationAttempts(steps)).toBe(2)
    expect(explanationAttemptsLeft(steps)).toBe(true)
    expect(explanationAttemptsLeft([...steps, { content: [invalid] }])).toBe(
      false
    )
  })
})
