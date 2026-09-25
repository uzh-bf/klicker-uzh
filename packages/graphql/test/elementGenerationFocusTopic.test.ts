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

import type { StartElementGenerationInput } from '../src/services/elementGeneration.js'
import {
  getElementGenerationCapabilities,
  startElementGeneration,
} from '../src/services/elementGeneration.js'

/**
 * The focus capability is a per-actor rollout decision, so every case states the
 * decision its actor received instead of a deployment-wide setting.
 * `unevaluatedCtx` carries no evaluator at all, which is what a deployment
 * without a usable payload produces.
 */
function contextWithFocusTopic(decision: boolean): ContextWithUser {
  return {
    user: { sub: 'focus-actor' },
    featureFlags: {
      isEnabled: () => decision,
      getAiBetaDecision: () => 'enabled',
      refresh: async () => undefined,
    },
    prisma: {
      user: { findUnique: async () => ({ betaEnabled: true }) },
    },
  } as unknown as ContextWithUser
}

const admittedCtx = contextWithFocusTopic(true)
const deniedCtx = contextWithFocusTopic(false)
const unevaluatedCtx = {} as ContextWithUser

function typesSupportingFocus(
  capabilities: Awaited<ReturnType<typeof getElementGenerationCapabilities>>
): string[] {
  return capabilities.typeCapabilities
    .filter((capability) => capability.supportsFocusTopic)
    .map((capability) => capability.elementType)
}

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
  })

  it('advertises the focus capability only for the actors and types the rollout admits', async () => {
    const admitted = await getElementGenerationCapabilities(admittedCtx)
    expect(admitted.languages).toEqual(['de', 'en'])
    expect(typesSupportingFocus(admitted)).toEqual(['SC', 'MC', 'KPRIM'])

    for (const closedCtx of [deniedCtx, unevaluatedCtx]) {
      expect(
        typesSupportingFocus(await getElementGenerationCapabilities(closedCtx))
      ).toEqual([])
    }
  })

  it('passes a trimmed focus topic to question generation', async () => {
    await startElementGeneration(
      input({ focusTopic: '  Portfolio diversification  ' }),
      admittedCtx
    )

    expect(starts.question).toHaveBeenCalledWith(
      expect.objectContaining({ focusTopic: 'Portfolio diversification' }),
      admittedCtx
    )
    expect(starts.flashcard).not.toHaveBeenCalled()
  })

  it('refuses a focus topic the actor is not admitted to', async () => {
    for (const ctx of [deniedCtx, unevaluatedCtx]) {
      await expect(
        startElementGeneration(
          input({ focusTopic: 'Portfolio diversification' }),
          ctx
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'CONFIGURATION_INVALID' })
      )
    }
    expect(starts.question).not.toHaveBeenCalled()
  })

  it('rejects a focus topic for flashcard generation', async () => {
    await expect(
      startElementGeneration(
        input({
          elementType: 'FLASHCARD',
          focusTopic: 'Portfolio diversification',
        }),
        admittedCtx
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'CONFIGURATION_INVALID' })
    )
    expect(starts.flashcard).not.toHaveBeenCalled()
  })

  it('treats a blank focus topic as absent without the capability', async () => {
    await startElementGeneration(input({ focusTopic: '   ' }), unevaluatedCtx)

    expect(starts.question).toHaveBeenCalledWith(
      expect.objectContaining({ focusTopic: null }),
      unevaluatedCtx
    )
  })
})
