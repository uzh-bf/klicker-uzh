import * as DB from '@klicker-uzh/prisma/client'
import { suggestGeneratedQuestionTags } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  normalizeQuestionTagSelection,
  questionTagSelectionsEqual,
  questionTagSelectionWrite,
  resolveQuestionTagSelection,
  withQuestionTagConflictRetry,
} from '../src/services/generatedQuestionTags.js'

type TagRow = { id: number; name: string }

function tagTransaction(ownerTags: TagRow[]) {
  const created: TagRow[] = []
  const transaction = {
    tag: {
      findMany: async ({
        where,
      }: {
        where: { ownerId: string; id: { in: number[] } }
      }) => ownerTags.filter((tag) => where.id.in.includes(tag.id)),
      findUnique: async ({
        where,
      }: {
        where: { ownerId_name: { ownerId: string; name: string } }
      }) =>
        ownerTags.find((tag) => tag.name === where.ownerId_name.name) ?? null,
      create: async ({ data }: { data: { name: string } }) => {
        const row = { id: 900 + created.length, name: data.name }
        created.push(row)
        ownerTags.push(row)
        return { id: row.id }
      },
    },
  }
  return {
    transaction: transaction as unknown as DB.Prisma.TransactionClient,
    created,
  }
}

describe('generated question tag suggestions', () => {
  const ownerTags: TagRow[] = [
    { id: 1, name: 'Portfolio' },
    { id: 2, name: 'Diversifikation' },
    { id: 3, name: 'Statistik Grundlagen' },
    { id: 4, name: 'Regression' },
  ]

  it('ranks exact matches before normalized matches', () => {
    expect(
      suggestGeneratedQuestionTags(['portfolio', 'Regression'], ownerTags)
    ).toEqual({ existingTagIds: [4, 1], newTagNames: [] })
  })

  it('matches conservative token overlap and drops weak overlaps', () => {
    expect(
      suggestGeneratedQuestionTags(
        ['Statistik Grundlagen Übersicht', 'Portfolio Theorie'],
        ownerTags
      )
    ).toEqual({
      existingTagIds: [3],
      newTagNames: ['Portfolio Theorie'],
    })
  })

  it('proposes unmatched labels without duplicating owner tags', () => {
    expect(
      suggestGeneratedQuestionTags(
        ['Volatilität', 'volatilität', 'Diversifikation'],
        ownerTags
      )
    ).toEqual({ existingTagIds: [2], newTagNames: ['Volatilität'] })
  })

  it('counts a repeated token once when scoring overlap', () => {
    expect(
      suggestGeneratedQuestionTags(
        ['Diversifikation Diversifikation Strategie'],
        ownerTags
      )
    ).toEqual({
      existingTagIds: [],
      newTagNames: ['Diversifikation Diversifikation Strategie'],
    })
  })

  it('caps recommendations at five existing and five new proposals', () => {
    const manyTags = Array.from({ length: 8 }, (_, index) => ({
      id: 10 + index,
      name: `Thema ${index}`,
    }))
    const matched = suggestGeneratedQuestionTags(
      manyTags.map((tag) => tag.name),
      manyTags
    )
    expect(matched.existingTagIds).toEqual([10, 11, 12, 13, 14])
    expect(matched.newTagNames).toEqual([])

    const proposals = suggestGeneratedQuestionTags(
      Array.from({ length: 8 }, (_, index) => `Neuartig ${index}`),
      []
    )
    expect(proposals.existingTagIds).toEqual([])
    expect(proposals.newTagNames).toHaveLength(5)
  })
})

describe('generated question tag selection', () => {
  it('normalizes, deduplicates and validates a selection', () => {
    expect(
      normalizeQuestionTagSelection({
        existingTagIds: [3, 3, 1],
        newTagNames: ['  Ordinal  ', 'Ordinal'],
      })
    ).toEqual({ existingTagIds: [3, 1], newTagNames: ['Ordinal'] })

    expect(() =>
      normalizeQuestionTagSelection({ existingTagIds: [0], newTagNames: [] })
    ).toThrowError(/identifiers are invalid/)
    expect(() =>
      normalizeQuestionTagSelection({
        existingTagIds: [],
        newTagNames: ['  '],
      })
    ).toThrowError(/names are invalid/)
  })

  it('preserves an omitted selection, clears an empty one and replaces for legacy tags', () => {
    const stored = { existingTagIds: [7], newTagNames: [] }

    expect(questionTagSelectionWrite({}, stored)).toEqual({
      mode: 'selection',
      selection: stored,
    })
    expect(questionTagSelectionWrite({}, undefined)).toEqual({ mode: 'none' })
    expect(
      questionTagSelectionWrite(
        { tagSelection: { existingTagIds: [], newTagNames: [] } },
        stored
      )
    ).toEqual({
      mode: 'selection',
      selection: { existingTagIds: [], newTagNames: [] },
    })
    expect(questionTagSelectionWrite({ tags: [' Neu '] }, stored)).toEqual({
      mode: 'legacy',
      selection: { existingTagIds: [], newTagNames: ['Neu'] },
    })
  })

  it('rejects requests that supply both representations', () => {
    expect(() =>
      questionTagSelectionWrite(
        {
          tags: ['Alt'],
          tagSelection: { existingTagIds: [1], newTagNames: [] },
        },
        undefined
      )
    ).toThrowError(/not both/)
  })

  it('compares selections by order-insensitive ids', () => {
    expect(
      questionTagSelectionsEqual(
        { existingTagIds: [1], newTagNames: ['A'] },
        { existingTagIds: [1], newTagNames: ['A'] }
      )
    ).toBe(true)
    expect(questionTagSelectionsEqual(undefined, undefined)).toBe(true)
    expect(
      questionTagSelectionsEqual(undefined, {
        existingTagIds: [],
        newTagNames: [],
      })
    ).toBe(false)
  })
})

describe('generated question tag resolution', () => {
  const selection = { existingTagIds: [1], newTagNames: [] }

  it('validates existing ids against the owner', async () => {
    const { transaction } = tagTransaction([{ id: 1, name: 'Portfolio' }])
    await expect(
      resolveQuestionTagSelection(transaction, 'owner-1', selection)
    ).resolves.toEqual([1])

    const { transaction: foreign } = tagTransaction([{ id: 2, name: 'Other' }])
    await expect(
      resolveQuestionTagSelection(foreign, 'owner-1', selection)
    ).rejects.toThrowError(/not available to this owner/)
  })

  it('resolves a proposal to an existing exact-name tag without creating it', async () => {
    const { transaction, created } = tagTransaction([
      { id: 5, name: 'Volatilität' },
    ])
    await expect(
      resolveQuestionTagSelection(transaction, 'owner-1', {
        existingTagIds: [],
        newTagNames: ['Volatilität'],
      })
    ).resolves.toEqual([5])
    expect(created).toEqual([])
  })

  it('creates a missing proposal only when creating is allowed', async () => {
    const { transaction, created } = tagTransaction([])
    await expect(
      resolveQuestionTagSelection(transaction, 'owner-1', {
        existingTagIds: [],
        newTagNames: ['Neuartig'],
      })
    ).resolves.toEqual([900])
    expect(created).toEqual([{ id: 900, name: 'Neuartig' }])

    const { transaction: resolveOnly, created: untouched } = tagTransaction([])
    await expect(
      resolveQuestionTagSelection(
        resolveOnly,
        'owner-1',
        { existingTagIds: [], newTagNames: ['Neuartig'] },
        'resolve-only'
      )
    ).resolves.toBeNull()
    expect(untouched).toEqual([])
  })

  it('resolves a shared name and id once', async () => {
    const { transaction } = tagTransaction([{ id: 5, name: 'Volatilität' }])
    await expect(
      resolveQuestionTagSelection(transaction, 'owner-1', {
        existingTagIds: [5],
        newTagNames: ['Volatilität'],
      })
    ).resolves.toEqual([5])
  })
})

describe('generated question tag conflict retry', () => {
  function ownerNameConflict() {
    return new DB.Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['ownerId', 'name'] },
      }
    )
  }

  // The shape Prisma 7 with a driver adapter reports for a real duplicate: the
  // violated columns sit on the adapter cause, quoted as SQL identifiers.
  function adapterConflict(
    causeOverrides: Record<string, unknown> = {},
    modelName = 'Tag'
  ) {
    return new DB.Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: ("ownerId", name)',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: {
          modelName,
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              originalCode: '23505',
              constraint: { fields: ['"ownerId"', 'name'] },
              originalMessage:
                'duplicate key value violates unique constraint "Tag_ownerId_name_key"',
              ...causeOverrides,
            },
          },
        },
      }
    )
  }

  it('retries the whole transaction and settles on success', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(ownerNameConflict())
      .mockResolvedValueOnce('kept')
    await expect(withQuestionTagConflictRetry(run)).resolves.toBe('kept')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts of the owner/name conflict', async () => {
    const run = vi.fn().mockRejectedValue(ownerNameConflict())
    await expect(withQuestionTagConflictRetry(run)).rejects.toThrowError(
      /Unique constraint failed/
    )
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('propagates unrelated conflicts and failures immediately', async () => {
    const unrelated = new DB.Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['draftId'] },
      }
    )
    const conflictRun = vi.fn().mockRejectedValue(unrelated)
    await expect(withQuestionTagConflictRetry(conflictRun)).rejects.toThrow()
    expect(conflictRun).toHaveBeenCalledTimes(1)

    const failureRun = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withQuestionTagConflictRetry(failureRun)).rejects.toThrowError(
      'boom'
    )
    expect(failureRun).toHaveBeenCalledTimes(1)
  })

  it('does not retry a conflict it cannot attribute to the owner/name tag', async () => {
    const unidentified = new DB.Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.8.0' }
    )
    const foreignModel = new DB.Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { modelName: 'Other', target: ['ownerId', 'name'] },
      }
    )

    for (const conflict of [unidentified, foreignModel]) {
      const run = vi.fn().mockRejectedValue(conflict)
      await expect(withQuestionTagConflictRetry(run)).rejects.toThrowError(
        /Unique constraint failed/
      )
      expect(run).toHaveBeenCalledTimes(1)
    }
  })

  it('retries the driver-adapter owner/name constraint report', async () => {
    const reports = [
      adapterConflict(),
      adapterConflict({ constraint: { fields: ['"ownerId"', '"name"'] } }),
      adapterConflict({ constraint: { fields: ['ownerId', 'name'] } }),
    ]

    for (const report of reports) {
      const run = vi
        .fn()
        .mockRejectedValueOnce(report)
        .mockResolvedValueOnce('kept')
      await expect(withQuestionTagConflictRetry(run)).resolves.toBe('kept')
      expect(run).toHaveBeenCalledTimes(2)
    }
  })

  it('keeps failing closed for unrelated driver-adapter reports', async () => {
    const reports = [
      adapterConflict({ kind: 'ForeignKeyViolation' }),
      adapterConflict({ kind: undefined }),
      adapterConflict({ constraint: { fields: ['"draftId"'] } }),
      adapterConflict({ constraint: { fields: ['"ownerId"'] } }),
      adapterConflict({ constraint: { fields: 'ownerId' } }),
      adapterConflict({}, 'Other'),
    ]

    for (const report of reports) {
      const run = vi.fn().mockRejectedValue(report)
      await expect(withQuestionTagConflictRetry(run)).rejects.toThrow()
      expect(run).toHaveBeenCalledTimes(1)
    }
  })
})
