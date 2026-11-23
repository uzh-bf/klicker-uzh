import { MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHOW_EXPLANATION_TOOL_NAME } from '@/src/lib/explanations'
import {
  createShowExplanationTool,
  explanationAttemptsLeft,
  explanationWriterReasoningEffort,
  failedExplanationAttempts,
  resolveExplanationWriterConfig,
  shouldOfferExplanationTool,
  validateExplanation,
  writeExplanation,
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

  it('returns hints only when asked, after the errors or as a review of a valid draft', async () => {
    const content = { format: 'explainer/1' }
    vi.stubGlobal(
      'fetch',
      respond(200, { ok: true, errors: [], hints: ['tracks.main.steps[2]: x'] })
    )
    expect(await validateExplanation(content)).toEqual({
      kind: 'explanation',
      content,
    })
    expect(await validateExplanation(content, { withHints: true })).toEqual({
      kind: 'explanation-review',
      hints: ['tracks.main.steps[2]: x'],
    })
    vi.stubGlobal(
      'fetch',
      respond(200, { ok: false, errors: ['a: e'], hints: ['b: h'] })
    )
    expect(await validateExplanation(content, { withHints: true })).toEqual({
      kind: 'explanation-invalid',
      errors: ['a: e'],
      hints: ['b: h'],
    })
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

describe('explanation writer', () => {
  const usage = {
    inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 50, text: 50, reasoning: 0 },
  }
  const draft = (n: number) => ({
    content: [
      {
        type: 'tool-call' as const,
        toolCallId: `d${n}`,
        toolName: 'submit_explanation',
        input: JSON.stringify({ format: 'explainer/1', draft: n }),
      },
    ],
    finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
    usage,
    warnings: [],
  })
  const brief = {
    locale: 'en' as const,
    topic: 'NPV',
    brief: 'Show NPV.',
    misconception: 'Thinks a higher rate raises NPV.',
  }
  /* Answers the schema request and each validation in turn. */
  const service = (...reports: unknown[]) =>
    vi.fn(async (url: string) => {
      const body = url.endsWith('/schema')
        ? { type: 'object' }
        : (reports.shift() ?? { ok: true, errors: [] })
      return new Response(JSON.stringify(body), { status: 200 })
    })

  beforeEach(() => {
    vi.stubEnv('EXPLAINER_SERVICE_URL', 'http://explainer.test')
    vi.stubEnv('EXPLAINER_SERVICE_TOKEN', 'synthetic-token')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns errors and hints to the writer and shows the repaired draft', async () => {
    vi.stubGlobal(
      'fetch',
      service(
        { ok: false, errors: ['steps.a: e'], hints: ['steps.b: h'] },
        { ok: true, errors: [], hints: ['steps.b: h'] }
      )
    )
    const model = new MockLanguageModelV4({ doGenerate: [draft(1), draft(2)] })
    const used: number[] = []
    const { result, drafts } = await writeExplanation({
      brief,
      writer: { modelId: 'writer', model },
      onStepUsage: ({ inputTokens }) => used.push(inputTokens),
    })
    expect(result).toEqual({
      kind: 'explanation',
      content: { format: 'explainer/1', draft: 2 },
    })
    expect(drafts).toBe(2)
    expect(used).toEqual([100, 100])
    const first = JSON.stringify(model.doGenerateCalls[0]!.prompt)
    expect(first).toContain('Misconception to address')
    expect(first).not.toContain('Course notation')
    const repair = JSON.stringify(model.doGenerateCalls[1]!.prompt)
    expect(repair).toContain('steps.a: e')
    expect(repair).toContain('steps.b: h')
  })

  it('gives up after three drafts and reports the last errors', async () => {
    vi.stubGlobal(
      'fetch',
      service(
        { ok: false, errors: ['a: 1'] },
        { ok: false, errors: ['a: 2'] },
        { ok: false, errors: ['a: 3'] }
      )
    )
    const model = new MockLanguageModelV4({
      doGenerate: [draft(1), draft(2), draft(3), draft(4)],
    })
    const { result, drafts } = await writeExplanation({
      brief,
      writer: { modelId: 'writer', model },
    })
    expect(drafts).toBe(3)
    expect(result).toEqual({ kind: 'explanation-invalid', errors: ['a: 3'] })
  })

  it('shows a valid draft held back for hints when the revision fails', async () => {
    vi.stubGlobal(
      'fetch',
      service(
        { ok: true, errors: [], hints: ['steps.b: h'] },
        { ok: false, errors: ['a: 2'] },
        { ok: false, errors: ['a: 3'] }
      )
    )
    const model = new MockLanguageModelV4({
      doGenerate: [draft(1), draft(2), draft(3)],
    })
    const { result } = await writeExplanation({
      brief,
      writer: { modelId: 'writer', model },
    })
    expect(result).toEqual({
      kind: 'explanation',
      content: { format: 'explainer/1', draft: 1 },
    })
  })

  it('reports the service as unavailable when no writer is set', async () => {
    vi.stubGlobal('fetch', service())
    const showExplanation = await createShowExplanationTool({
      getWriter: () => null,
      onUsage: () => {},
    })
    const outputs = []
    for await (const output of showExplanation.execute!(brief, {
      toolCallId: 't',
      messages: [],
      context: {},
    }) as AsyncIterable<unknown>)
      outputs.push(output)
    expect(outputs).toEqual([{ kind: 'explanation-unavailable' }])
  })

  it('uses the configured writer unless the turn runs on a fallback model', () => {
    const turn = { id: 'auto', fallback: false }
    const registry = [turn, { id: 'gpt-6.2-sol', fallback: false }]
    expect(resolveExplanationWriterConfig(registry, turn).id).toBe(
      'gpt-6.2-sol'
    )
    const fallback = { id: 'gpt-6-luna', fallback: true }
    expect(resolveExplanationWriterConfig(registry, fallback)).toBe(fallback)
    vi.stubEnv('CHAT_EXPLANATION_WRITER_MODEL_ID', 'missing')
    expect(resolveExplanationWriterConfig(registry, turn)).toBe(turn)
    expect(
      explanationWriterReasoningEffort({
        supportedReasoningEfforts: ['low', 'medium'],
      })
    ).toBe('medium')
    expect(explanationWriterReasoningEffort({})).toBeUndefined()
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

  it('counts rejected and malformed calls, and withdraws the tool after one', () => {
    const steps = [{ content: [invalid] }, { content: [malformed, other] }]
    expect(failedExplanationAttempts(steps)).toBe(2)
    expect(explanationAttemptsLeft([{ content: [other] }])).toBe(true)
    expect(explanationAttemptsLeft([{ content: [malformed] }])).toBe(false)
  })
})

describe('explanation tool gate', () => {
  beforeEach(() => {
    vi.stubEnv('CHAT_EXPLANATION_TOOL', '1')
    vi.stubEnv('EXPLAINER_SERVICE_URL', 'http://explainer.test/')
    vi.stubEnv('EXPLAINER_SERVICE_TOKEN', 'synthetic-token')
  })
  afterEach(() => vi.unstubAllEnvs())

  const offer = (
    overrides: Partial<Parameters<typeof shouldOfferExplanationTool>[0]> = {},
    flag = vi.fn(async () => true)
  ) =>
    shouldOfferExplanationTool({
      chatMode: 'tutor',
      chatbotSettingEnabled: true,
      isOwnerFlagEnabled: flag,
      ...overrides,
    })

  it('offers the tool only when the env gate, setting and flag all allow it', async () => {
    expect(await offer()).toBe(true)
    expect(await offer({ chatbotSettingEnabled: false })).toBe(false)
    expect(await offer({ isOwnerFlagEnabled: async () => false })).toBe(false)
    vi.stubEnv('CHAT_EXPLANATION_TOOL', '0')
    expect(await offer()).toBe(false)
  })

  it('looks up the flag only after the cheaper checks pass', async () => {
    const flag = vi.fn(async () => true)
    await offer({ chatbotSettingEnabled: false }, flag)
    await offer({ chatMode: 'quizzer' }, flag)
    expect(flag).not.toHaveBeenCalled()
  })
})
