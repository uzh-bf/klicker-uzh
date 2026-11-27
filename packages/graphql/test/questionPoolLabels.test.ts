import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  buildQuestionPoolBloomRequest,
  buildQuestionPoolDifficultyRequest,
  createQuestionPoolLabelBackend,
  getQuestionPoolLabelDifficultyBand,
  QUESTION_POOL_LABEL_MODEL,
  QuestionPoolLabelAdapterError,
  type QuestionPoolLabelCourseCalibrations,
  type QuestionPoolLabelItem,
  type QuestionPoolLabelRuntimeConfig,
  questionPoolDifficultyPromptFingerprint,
  readQuestionPoolLabelRuntimeConfig,
} from '../src/services/questionPoolLabels.js'

const fixtureCredential = randomUUID()
const financeCourseId = 'synthetic-finance-course'
const bankingCourseId = 'synthetic-banking-course'
const decisionEndpoint =
  'https://foundry-uzh-df-synthetic.services.ai.azure.com/providers/microsoft/v1/systemone'

const scItem: QuestionPoolLabelItem = {
  format: 'SC',
  stem: 'Which synthetic statement is true?',
  choices: [
    { text: 'Synthetic key', key: true },
    { text: 'Synthetic distractor', key: false },
  ],
}

const kprimItem: QuestionPoolLabelItem = {
  format: 'KPRIM',
  stem: 'Judge each synthetic statement.',
  choices: [
    { text: 'Synthetic statement 1', key: true },
    { text: 'Synthetic statement 2', key: false },
    { text: 'Synthetic statement 3', key: false },
    { text: 'Synthetic statement 4', key: true },
  ],
}

const syntheticCalibrations: QuestionPoolLabelCourseCalibrations = {
  [financeCourseId]: {
    version: 1,
    model: QUESTION_POOL_LABEL_MODEL,
    clip: 0.01,
    course: 'Synthetic Finance Course',
    evidence_sha256: 'synthetic-evidence',
    exam_manifest_digest_prefix: 'synthetic-exam',
    method: 'synthetic-method',
    practice_cohort_sha256: 'synthetic-cohort',
    formats: {
      SC: {
        prompt_sha256: questionPoolDifficultyPromptFingerprint('SC'),
        intercept: 0.1,
        slope: 1.2,
        fitted_raw_range: [0.05, 0.95],
        fit_count: 1,
      },
      KPRIM: {
        prompt_sha256: questionPoolDifficultyPromptFingerprint('KPRIM'),
        intercept: 0.1,
        slope: 1.2,
        fitted_raw_range: [0.05, 0.95],
        fit_count: 1,
      },
    },
  },
}

type CapturedRequest = {
  state: {
    course_name?: string
    instructions?: string
  }
  questions: Record<string, unknown>
}

function runtimeConfig(
  overrides: Partial<QuestionPoolLabelRuntimeConfig> = {}
): QuestionPoolLabelRuntimeConfig {
  return {
    enabled: true,
    endpoint: decisionEndpoint,
    apiKey: fixtureCredential,
    financeCourseIds: [financeCourseId],
    calibrationsByCourse: syntheticCalibrations,
    timeoutMs: 5_000,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function difficultyAnswers(item: QuestionPoolLabelItem, rawRate: number) {
  const answers = {
    full_credit: { noul: rawRate },
  } as Record<string, { noul: number }>
  if (item.format === 'KPRIM') {
    for (let position = 1; position <= 4; position += 1) {
      answers['statement_' + position] = { noul: 0.8 }
    }
  }
  return answers
}

function decisionResponses(
  item: QuestionPoolLabelItem,
  rawRate: number,
  bloom = 'apply'
) {
  return vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as CapturedRequest
    if ('bloom' in request.questions) {
      return jsonResponse({
        model: QUESTION_POOL_LABEL_MODEL,
        answers: { bloom: { choice: bloom } },
      })
    }

    return jsonResponse({
      model: 'microsoft-decision-1.1',
      answers: difficultyAnswers(item, rawRate),
    })
  }) as unknown as typeof fetch
}

function capturedRequests(fetchImpl: typeof fetch): CapturedRequest[] {
  return vi
    .mocked(fetchImpl)
    .mock.calls.map((call) => JSON.parse(String(call[1]?.body)))
}

function findBloomRequest(requests: CapturedRequest[]) {
  return requests.find((request) => 'bloom' in request.questions)!
}

function findDifficultyRequest(requests: CapturedRequest[]) {
  return requests.find((request) => !('bloom' in request.questions))!
}

describe('question pool Decision 1.1 requests', () => {
  it('builds the source-free Finance I Bloom request for a valid SC item', () => {
    const request = buildQuestionPoolBloomRequest(scItem, {
      financeTemplate: true,
    })

    expect(request.model).toBe('decision-1.1')
    expect(request.state).toEqual({
      format: 'SC',
      stem: scItem.stem,
      choices: scItem.choices,
    })
    expect(request.questions.bloom.type).toBe('choice')
    expect(Object.keys(request.questions.bloom.criteria)).toEqual([
      'remember',
      'understand',
      'apply',
      'analyze',
      'evaluate',
    ])
  })

  it('uses format-specific difficulty questions and keys', () => {
    const scRequest = buildQuestionPoolDifficultyRequest(scItem, {
      financeTemplate: true,
    })
    const kprimRequest = buildQuestionPoolDifficultyRequest(kprimItem, {
      financeTemplate: true,
    })

    expect(scRequest.model).toBe('decision-1.1')
    expect(Object.keys(scRequest.questions)).toEqual(['full_credit'])
    expect(scRequest.state.target.options).toEqual([
      { text: 'Synthetic key', correct: true },
      { text: 'Synthetic distractor', correct: false },
    ])

    expect(kprimRequest.state.target.options).toHaveLength(4)
    expect(Object.keys(kprimRequest.questions)).toEqual([
      'full_credit',
      'statement_1',
      'statement_2',
      'statement_3',
      'statement_4',
    ])
    expect(kprimRequest.state.format_guidance).not.toBe(
      scRequest.state.format_guidance
    )
  })

  it('rejects malformed SC keys and non-quadruple KPRIM choices', () => {
    expect(() =>
      buildQuestionPoolBloomRequest(
        {
          ...scItem,
          choices: scItem.choices.map((choice) => ({
            ...choice,
            key: false,
          })),
        },
        { financeTemplate: true }
      )
    ).toThrow(QuestionPoolLabelAdapterError)

    expect(() =>
      buildQuestionPoolDifficultyRequest(
        {
          ...kprimItem,
          choices: kprimItem.choices.slice(0, 3),
        },
        { financeTemplate: true }
      )
    ).toThrow(QuestionPoolLabelAdapterError)
  })

  it('exports the shared observed difficulty band thresholds', () => {
    expect(getQuestionPoolLabelDifficultyBand(0.85, 'SC')).toBe(1)
    expect(getQuestionPoolLabelDifficultyBand(0.7, 'SC')).toBe(2)
    expect(getQuestionPoolLabelDifficultyBand(0.55, 'SC')).toBe(3)
    expect(getQuestionPoolLabelDifficultyBand(0.4, 'SC')).toBe(4)
    expect(getQuestionPoolLabelDifficultyBand(0.3999, 'SC')).toBe(5)
    expect(getQuestionPoolLabelDifficultyBand(0.4, 'KPRIM')).toBe(3)
  })
})

describe('question pool label runtime configuration', () => {
  it('reads private Finance IDs and snake_case calibration keys', () => {
    const config = readQuestionPoolLabelRuntimeConfig({
      QUESTION_POOL_LABEL_PREVIEW_ENABLED: 'true',
      QUESTION_POOL_LABEL_MODEL_ENDPOINT: decisionEndpoint,
      QUESTION_POOL_LABEL_MODEL_API_KEY: fixtureCredential,
      QUESTION_POOL_LABEL_FINANCE_COURSE_IDS_JSON: JSON.stringify([
        financeCourseId,
      ]),
      QUESTION_POOL_LABEL_CALIBRATIONS_JSON: JSON.stringify(
        syntheticCalibrations
      ),
      QUESTION_POOL_LABEL_TIMEOUT_MS: '5000',
    })

    expect(config.financeCourseIds).toEqual([financeCourseId])
    expect(
      config.calibrationsByCourse[financeCourseId]?.formats.SC.prompt_sha256
    ).toBe(questionPoolDifficultyPromptFingerprint('SC'))
  })

  it('skips malformed calibration entries without discarding valid ones', () => {
    const config = readQuestionPoolLabelRuntimeConfig({
      QUESTION_POOL_LABEL_PREVIEW_ENABLED: 'true',
      QUESTION_POOL_LABEL_MODEL_ENDPOINT: decisionEndpoint,
      QUESTION_POOL_LABEL_MODEL_API_KEY: fixtureCredential,
      QUESTION_POOL_LABEL_FINANCE_COURSE_IDS_JSON: JSON.stringify([
        financeCourseId,
      ]),
      QUESTION_POOL_LABEL_CALIBRATIONS_JSON: JSON.stringify({
        [financeCourseId]: syntheticCalibrations[financeCourseId],
        'synthetic-invalid-course': { formats: { SC: 'invalid' } },
      }),
    })

    expect(config.calibrationsByCourse[financeCourseId]).toBeDefined()
    expect(
      config.calibrationsByCourse['synthetic-invalid-course']
    ).toBeUndefined()
  })

  it('treats an invalid entire calibration payload as absent', () => {
    const config = readQuestionPoolLabelRuntimeConfig({
      QUESTION_POOL_LABEL_PREVIEW_ENABLED: 'true',
      QUESTION_POOL_LABEL_MODEL_ENDPOINT: decisionEndpoint,
      QUESTION_POOL_LABEL_MODEL_API_KEY: fixtureCredential,
      QUESTION_POOL_LABEL_CALIBRATIONS_JSON: '{invalid-json',
    })

    expect(config.calibrationsByCourse).toEqual({})
  })
})

describe('question pool label backend', () => {
  it('makes no model call while previews are disabled', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig({ enabled: false }),
      fetchImpl,
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses Finance I templates and calibration only for a mapped Finance course', async () => {
    const fetchImpl = decisionResponses(scItem, 0.42)
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig(),
      fetchImpl,
    })

    const result = await backend.label({
      courseId: financeCourseId,
      item: scItem,
    })
    const requests = capturedRequests(fetchImpl)
    const bloomRequest = findBloomRequest(requests)
    const difficultyRequest = findDifficultyRequest(requests)

    expect(result).toMatchObject({
      rawRate: 0.42,
      rawBand: 4,
      bloom: 'apply',
    })
    expect(result?.calibratedRate).toBeTypeOf('number')
    expect(result?.calibratedBand).toBeGreaterThanOrEqual(1)
    expect(result?.calibratedBand).toBeLessThanOrEqual(5)
    expect(bloomRequest.state.course_name).toBeUndefined()
    expect(difficultyRequest.state.course_name).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    const firstCall = vi.mocked(fetchImpl).mock.calls[0]!
    expect(firstCall[0]).toBe(decisionEndpoint)
    expect(firstCall[1]?.headers).toMatchObject({
      'api-key': fixtureCredential,
      'Content-Type': 'application/json',
    })
  })

  it('uses selected-course prompts and raw values for an unmapped course', async () => {
    const fetchImpl = decisionResponses(scItem, 0.42)
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig(),
      fetchImpl,
    })

    await expect(
      backend.label({
        courseId: bankingCourseId,
        item: scItem,
      })
    ).resolves.toEqual({
      rawRate: 0.42,
      rawBand: 4,
      calibratedRate: null,
      calibratedBand: null,
      bloom: 'apply',
    })

    const requests = capturedRequests(fetchImpl)
    const bloomRequest = findBloomRequest(requests)
    const difficultyRequest = findDifficultyRequest(requests)
    expect(bloomRequest.state.course_name).toBeUndefined()
    expect(difficultyRequest.state.course_name).toBeUndefined()
  })

  it('returns raw values when a Finance course has no calibration', async () => {
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig({ calibrationsByCourse: {} }),
      fetchImpl: decisionResponses(scItem, 0.42),
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toEqual({
      rawRate: 0.42,
      rawBand: 4,
      calibratedRate: null,
      calibratedBand: null,
      bloom: 'apply',
    })
  })

  it('returns raw values when calibration validation fails', async () => {
    const invalidCalibrations = structuredClone(syntheticCalibrations)
    invalidCalibrations[financeCourseId]!.formats.SC.prompt_sha256 = '0'.repeat(
      64
    )
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig({ calibrationsByCourse: invalidCalibrations }),
      fetchImpl: decisionResponses(scItem, 0.42),
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toEqual({
      rawRate: 0.42,
      rawBand: 4,
      calibratedRate: null,
      calibratedBand: null,
      bloom: 'apply',
    })
  })

  it('validates KPRIM statement probabilities and preserves the display band', async () => {
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig({ calibrationsByCourse: {} }),
      fetchImpl: decisionResponses(kprimItem, 0.2),
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: kprimItem })
    ).resolves.toMatchObject({
      rawRate: 0.2,
      rawBand: 4,
      calibratedRate: null,
      calibratedBand: null,
      bloom: 'apply',
    })
  })

  it('returns null when Decision returns no valid Bloom answer', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as CapturedRequest
        if ('bloom' in request.questions) {
          return jsonResponse({
            model: QUESTION_POOL_LABEL_MODEL,
            answers: { bloom: { choice: 'invalid-level' } },
          })
        }
        return jsonResponse({
          model: QUESTION_POOL_LABEL_MODEL,
          answers: difficultyAnswers(scItem, 0.42),
        })
      }
    ) as unknown as typeof fetch
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig(),
      fetchImpl,
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toBeNull()
  })

  it('returns null when Decision omits a difficulty answer', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as CapturedRequest
        if ('bloom' in request.questions) {
          return jsonResponse({
            model: QUESTION_POOL_LABEL_MODEL,
            answers: { bloom: { choice: 'apply' } },
          })
        }
        return jsonResponse({
          model: QUESTION_POOL_LABEL_MODEL,
          answers: {},
        })
      }
    ) as unknown as typeof fetch
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig(),
      fetchImpl,
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toBeNull()
  })

  it('returns null after one failed request without provider fallback', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('synthetic transport failure')
    }) as unknown as typeof fetch
    const backend = createQuestionPoolLabelBackend({
      config: runtimeConfig(),
      fetchImpl,
    })

    await expect(
      backend.label({ courseId: financeCourseId, item: scItem })
    ).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(fetchImpl).mock.calls) {
      expect(call[0]).toBe(decisionEndpoint)
    }
  })

  it('rejects non-UZH model endpoints', () => {
    expect(() =>
      createQuestionPoolLabelBackend({
        config: runtimeConfig({
          endpoint: 'https://synthetic-provider.example/v1/decision',
        }),
      })
    ).toThrow('official UZH Decision 1.1')
  })
})
