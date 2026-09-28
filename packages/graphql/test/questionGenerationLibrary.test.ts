import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createQuestionLibrarySnapshot,
  normalizeQuestionLibraryElement,
  questionLibraryComparisonEnabled,
  questionLibraryComparisonMaxElements,
} from '../src/services/questionGenerationLibrary.js'

function element(
  overrides: Record<string, unknown> = {}
): Parameters<typeof normalizeQuestionLibraryElement>[0] {
  return {
    id: 42,
    version: 3,
    type: DB.ElementType.MC,
    name: 'Portfolio risk',
    content: 'Why can diversification reduce portfolio risk?',
    options: {
      displayMode: 'LIST',
      choices: [
        { ix: 1, value: 'It guarantees returns.', correct: false },
        {
          ix: 0,
          value: 'It reduces asset-specific risk.',
          correct: true,
        },
      ],
    },
    ...overrides,
  } as Parameters<typeof normalizeQuestionLibraryElement>[0]
}

function context(rows: ReturnType<typeof element>[]) {
  const findMany = vi.fn(async () => rows)
  return {
    findMany,
    ctx: {
      user: { sub: '123e4567-e89b-42d3-a456-426614174000' },
      prisma: { element: { findMany } },
    } as unknown as ContextWithUser,
  }
}

describe('question-library snapshot', () => {
  it('is disabled unless explicitly enabled', () => {
    expect(questionLibraryComparisonEnabled({})).toBe(false)
    expect(
      questionLibraryComparisonEnabled({
        KB_QUESTION_LIBRARY_COMPARISON_ENABLED: 'true',
      })
    ).toBe(true)
    expect(
      questionLibraryComparisonEnabled({
        KB_QUESTION_LIBRARY_COMPARISON_ENABLED: 'false',
      })
    ).toBe(false)
  })

  it('validates the adjustable bounded library size', () => {
    expect(questionLibraryComparisonMaxElements({})).toBe(500)
    expect(
      questionLibraryComparisonMaxElements({
        KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS: '25',
      })
    ).toBe(25)
    expect(() =>
      questionLibraryComparisonMaxElements({
        KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS: '501',
      })
    ).toThrow(/integer from 1 to 500/)
  })

  it('normalizes choice order without losing answer association', () => {
    expect(normalizeQuestionLibraryElement(element())).toEqual({
      element_id: 42,
      version: 3,
      element_type: 'MC',
      name: 'Portfolio risk',
      stem: 'Why can diversification reduce portfolio risk?',
      choices: [
        { text: 'It reduces asset-specific risk.', correct: true },
        { text: 'It guarantees returns.', correct: false },
      ],
    })
  })

  it('queries only owned active supported questions in deterministic order', async () => {
    const { ctx, findMany } = context([element()])
    const bytes = await createQuestionLibrarySnapshot(ctx, {
      KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS: '5',
    })

    expect(findMany).toHaveBeenCalledWith({
      where: {
        ownerId: '123e4567-e89b-42d3-a456-426614174000',
        isArchived: false,
        isDeleted: false,
        type: { in: ['SC', 'MC', 'KPRIM'] },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 6,
      select: {
        id: true,
        version: true,
        type: true,
        name: true,
        content: true,
        options: true,
      },
    })
    expect(JSON.parse(bytes.toString('utf8'))).toEqual({
      questions: [normalizeQuestionLibraryElement(element())],
      reference_count: 1,
      schema_version: 1,
      truncated: false,
    })
    expect(bytes.toString('utf8')).not.toContain(ctx.user.sub)
  })

  it('marks a deterministic recent-first snapshot as truncated', async () => {
    const { ctx } = context([element({ id: 2 }), element({ id: 1 })])

    const first = await createQuestionLibrarySnapshot(ctx, {
      KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS: '1',
    })
    const second = await createQuestionLibrarySnapshot(ctx, {
      KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS: '1',
    })

    expect(first.equals(second)).toBe(true)
    expect(JSON.parse(first.toString('utf8'))).toMatchObject({
      reference_count: 1,
      truncated: true,
      questions: [{ element_id: 2 }],
    })
  })

  it('fails closed on malformed choice data', () => {
    expect(() =>
      normalizeQuestionLibraryElement(element({ options: { choices: [] } }))
    ).toThrow(/choices must contain/)
  })
})
