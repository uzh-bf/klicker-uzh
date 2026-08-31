import { MAX_FREE_TEXT_EVALUATOR_RESPONSE_BYTES } from '@klicker-uzh/grading'
import type {
  EvaluateFreeTextRequestV1,
  FreeTextRubricSchema,
} from '@klicker-uzh/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSemanticFreeTextEvaluation } from '../src/services/semanticFreeTextEvaluator.js'

const rubricSchema: FreeTextRubricSchema = {
  schema_version: '1',
  name: 'Content quality',
  description: 'Evaluate the submitted answer.',
  rubrics: [
    {
      id: 'content',
      name: 'Content',
      description: 'The answer addresses the question.',
      weight: 1,
      achievement_levels: [
        {
          name: 'met',
          description: 'The answer meets the criterion.',
          normalized_score: 100,
        },
      ],
    },
  ],
}

const request: EvaluateFreeTextRequestV1 = {
  contract_version: '1',
  task_bundle_id: 'attempt-1',
  question: { content: 'Why?', language: 'en' },
  response: { text: 'Because.' },
  rubric_schema: rubricSchema,
}

describe('semantic free-text evaluator boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects an oversized streamed response before JSON parsing', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv(
      'CATALYST_FORMATIVE_EVALUATOR_URL',
      'http://127.0.0.1:7099/evaluate'
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('x'.repeat(MAX_FREE_TEXT_EVALUATOR_RESPONSE_BYTES + 1), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestSemanticFreeTextEvaluation({ request, rubricSchema })
    ).resolves.toEqual({
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:7099/evaluate',
      expect.objectContaining({ redirect: 'error' })
    )
  })

  it('rejects credentialed or insecure evaluator endpoints before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_TOKEN', 'test-token')

    for (const endpoint of [
      'http://evaluator.test/evaluate',
      'https://user:password@evaluator.test/evaluate',
      'https://evaluator.test/evaluate#redirect',
    ]) {
      vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', endpoint)
      await expect(
        requestSemanticFreeTextEvaluation({ request, rubricSchema })
      ).resolves.toEqual({
        ok: false,
        reason: 'EVALUATOR_RESULT_UNAVAILABLE',
        retryable: false,
      })
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('permits the explicit non-production container-to-host stub route', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_ALLOW_INSECURE_LOCAL', 'true')
    vi.stubEnv(
      'CATALYST_FORMATIVE_EVALUATOR_URL',
      'http://host.docker.internal:7099/evaluate'
    )
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"invalid":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await requestSemanticFreeTextEvaluation({ request, rubricSchema })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://host.docker.internal:7099/evaluate',
      expect.objectContaining({ redirect: 'error' })
    )
  })
})
