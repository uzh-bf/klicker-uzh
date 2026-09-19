import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const starts = vi.hoisted(() => ({
  question: vi.fn(async () => ({ kind: 'question' })),
  flashcard: vi.fn(async () => ({ kind: 'flashcard' })),
}))

vi.mock('../src/services/questionGeneration.js', () => ({
  startQuestionGeneration: starts.question,
}))
vi.mock('../src/services/flashcardGeneration.js', () => ({
  startFlashcardGeneration: starts.flashcard,
}))
vi.mock('../src/services/questionGenerationGraph.js', () => ({
  assertQuestionGenerationPreviewAccess: async () => undefined,
  getQuestionGenerationSources: async () => [],
}))

import { startElementGeneration } from '../src/services/elementGeneration.js'
import type { StartElementGenerationInput } from '../src/services/elementGeneration.js'

const ctx = {} as ContextWithUser

function input(
  overrides: Partial<StartElementGenerationInput> = {}
): StartElementGenerationInput {
  return {
    graphBuildId: '5e21a46a-94b4-44e9-8966-b36dc1908790',
    elementType: 'SC',
    language: 'de',
    elementCount: 6,
    idempotencyKey: 'focus-topic-key',
    ...overrides,
  }
}

describe('element generation focus topic gate', () => {
  afterEach(() => {
    starts.question.mockClear()
    starts.flashcard.mockClear()
    vi.unstubAllEnvs()
  })

  it('passes a trimmed focus topic to question generation', async () => {
    vi.stubEnv('QUESTION_GENERATION_FOCUS_TOPIC_ENABLED', 'true')

    await startElementGeneration(
      input({ focusTopic: '  Portfolio diversification  ' }),
      ctx
    )

    expect(starts.question).toHaveBeenCalledWith(
      expect.objectContaining({ focusTopic: 'Portfolio diversification' }),
      ctx
    )
    expect(starts.flashcard).not.toHaveBeenCalled()
  })

  it('refuses a focus topic when the capability is disabled', async () => {
    vi.stubEnv('QUESTION_GENERATION_FOCUS_TOPIC_ENABLED', 'false')

    await expect(
      startElementGeneration(
        input({ focusTopic: 'Portfolio diversification' }),
        ctx
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'CONFIGURATION_INVALID' })
    )
    expect(starts.question).not.toHaveBeenCalled()
  })

  it('rejects a focus topic for flashcard generation', async () => {
    vi.stubEnv('QUESTION_GENERATION_FOCUS_TOPIC_ENABLED', 'true')

    await expect(
      startElementGeneration(
        input({
          elementType: 'FLASHCARD',
          focusTopic: 'Portfolio diversification',
        }),
        ctx
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'CONFIGURATION_INVALID' })
    )
    expect(starts.flashcard).not.toHaveBeenCalled()
  })

  it('treats a blank focus topic as absent without the capability', async () => {
    await startElementGeneration(input({ focusTopic: '   ' }), ctx)

    expect(starts.question).toHaveBeenCalledWith(
      expect.objectContaining({ focusTopic: null }),
      ctx
    )
  })
})
