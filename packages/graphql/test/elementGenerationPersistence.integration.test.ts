import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { keepGeneratedElementDraft } from '../src/services/elementGeneration.js'
import { manipulateElement } from '../src/services/elements.js'

const current = {
  itemType: 'SC' as const,
  name: 'Synthetic generated question',
  stem: 'Which answer is correct?',
  context: null,
  explanation: 'A is correct.',
  choices: [
    {
      id: 'choice-a',
      label: 'A',
      text: 'Answer A',
      correct: true,
      feedback: null,
    },
    {
      id: 'choice-b',
      label: 'B',
      text: 'Answer B',
      correct: false,
      feedback: null,
    },
  ],
}

let ownerId: string
let foreignId: string
let draftId: string

function context(userId = ownerId, client = prisma): ContextWithUser {
  // The real persistence path uses these fields only; no provider or queue is used.
  return {
    prisma: client,
    emitter: new EventEmitter(),
    featureFlags: { isEnabled: () => true, refresh: async () => {} },
    user: {
      sub: userId,
      role: DB.UserRole.USER,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function keepInput(name = current.name, tag = 'synthetic-generated') {
  return {
    draftId,
    expectedRevision: 0,
    status: DB.ElementStatus.REVIEW,
    type: DB.ElementType.SC,
    name,
    content: current.stem,
    explanation: current.explanation,
    basePoints: true,
    pointsMultiplier: 2,
    tags: [tag],
    choiceIds: current.choices.map((choice) => choice.id),
    options: {
      displayMode: DisplayMode.LIST,
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      choices: current.choices.map((choice, ix) => ({
        ix,
        value: choice.text,
        correct: choice.correct,
        feedback: choice.feedback,
      })),
    },
  }
}

function concurrentContext() {
  let arrivals = 0
  let release!: () => void
  const bothTransactions = new Promise<void>((resolve) => {
    release = resolve
  })
  const client = prisma.$extends({
    query: {
      generatedElementDraft: {
        async findFirst({ args, query }) {
          const result = await query(args)
          // Both real transactions reach the ownership read before either locks the build.
          if (args.where?.id === draftId && args.select?.buildId === true) {
            arrivals += 1
            if (arrivals === 2) release()
            await bothTransactions
          }
          return result
        },
      },
    },
  })
  return context(ownerId, client as unknown as DB.PrismaClient)
}

async function persistedCounts() {
  const [elements, tags, logs, permissions] = await Promise.all([
    prisma.element.count({ where: { ownerId } }),
    prisma.tag.count({ where: { ownerId } }),
    prisma.activityLogEntry.count({
      where: { userId: ownerId, objectType: DB.ObjectType.ELEMENT },
    }),
    prisma.derivedPermission.count({
      where: { userId: ownerId, elementId: { not: null } },
    }),
  ])
  return { elements, tags, logs, permissions }
}

async function expectUnchangedDraft() {
  await expect(
    prisma.generatedElementDraft.findUniqueOrThrow({ where: { id: draftId } })
  ).resolves.toMatchObject({
    current,
    revision: 0,
    decision: DB.GeneratedElementDecision.OPEN,
    savedElementId: null,
    savedAt: null,
  })
}

describe('real generated Element persistence', () => {
  beforeEach(async () => {
    ownerId = randomUUID()
    foreignId = randomUUID()
    draftId = randomUUID()
    await prisma.user.createMany({
      data: [ownerId, foreignId].map((id) => ({
        id,
        email: `${id}@example.org`,
        shortname: `generation-${id.slice(0, 8)}`,
        aiFeaturesEnabled: true,
      })),
    })
    const kb = await prisma.kB.create({
      data: { ownerId, name: 'Synthetic generation persistence KB' },
    })
    const graph = await prisma.kBGraphBuild.create({
      data: {
        id: randomUUID(),
        kbId: kb.id,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `synthetic:${randomUUID()}`,
      },
    })
    const build = await prisma.elementGenerationBuild.create({
      data: {
        id: randomUUID(),
        ownerId,
        sourceGraphBuildId: graph.id,
        elementType: DB.ElementType.SC,
        idempotencyKey: randomUUID(),
        configurationHash: 'synthetic-persistence',
        configuration: {
          itemType: 'SC',
          language: 'en',
          questionCount: 1,
          objectives: [],
          sourceScopes: [],
          bloomLevels: ['remember'],
          difficultyPreset: 'D1',
          difficultyCounts: { d1: 1, d2: 0, d3: 0, d4: 0, d5: 0 },
        },
        requestedElementCount: 1,
        status: DB.ElementGenerationBuildStatus.COMPLETED,
      },
    })
    await prisma.generatedElementDraft.create({
      data: {
        id: draftId,
        buildId: build.id,
        sourceElementId: 'synthetic-source',
        order: 0,
        elementType: DB.ElementType.SC,
        original: {
          ...current,
          sourceQuestionId: 'synthetic-source',
          bloomLevel: 'remember',
          targetDifficulty: 3,
          predictedDifficulty: null,
          qualityFlags: [],
          citations: [],
        },
        current,
        targetDifficulty: 3,
        citations: [],
      },
    })
  })

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, foreignId] } },
    })
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('keeps simultaneous identical requests as one Element and one set of related rows', async () => {
    const ctx = concurrentContext()
    const [first, second] = await Promise.all([
      keepGeneratedElementDraft(keepInput(), ctx),
      keepGeneratedElementDraft(keepInput(), ctx),
    ])
    expect(first.savedElementId).not.toBeNull()
    expect(second.savedElementId).toBe(first.savedElementId)
    expect(first.revision).toBe(1)
    expect(second.revision).toBe(1)
    expect(await persistedCounts()).toEqual({
      elements: 1,
      tags: 1,
      logs: 1,
      permissions: 1,
    })
    await expect(
      prisma.generatedElementDraft.findUniqueOrThrow({ where: { id: draftId } })
    ).resolves.toMatchObject({
      savedElementId: first.savedElementId,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      revision: 1,
    })
    await expect(
      prisma.derivedPermission.findUniqueOrThrow({
        where: {
          elementId_userId: {
            elementId: first.savedElementId!,
            userId: ownerId,
          },
        },
      })
    ).resolves.toMatchObject({ permissionLevel: DB.PermissionLevel.OWNER })
  })

  it('rejects a conflicting concurrent keep without an orphan or loser tag', async () => {
    const ctx = concurrentContext()
    const inputs = [
      keepInput('First version', 'first-tag'),
      keepInput('Second version', 'second-tag'),
    ]
    const results = await Promise.allSettled(
      inputs.map((input) => keepGeneratedElementDraft(input, ctx))
    )
    const winnerIndex = results.findIndex(
      (result) => result.status === 'fulfilled'
    )
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(results[1 - winnerIndex]).toMatchObject({
      status: 'rejected',
      reason: { code: 'CONCURRENT_MODIFICATION' },
    })
    const saved = await prisma.element.findFirstOrThrow({
      where: { ownerId },
      include: { tags: true },
    })
    expect(saved.name).toBe(inputs[winnerIndex]!.name)
    expect(saved.tags.map((tag) => tag.name)).toEqual(inputs[winnerIndex]!.tags)
    expect(await persistedCounts()).toEqual({
      elements: 1,
      tags: 1,
      logs: 1,
      permissions: 1,
    })
    await expect(
      prisma.generatedElementDraft.findUniqueOrThrow({ where: { id: draftId } })
    ).resolves.toMatchObject({ savedElementId: saved.id, revision: 1 })
  })

  it('rolls back real Element writes when the final draft link fails', async () => {
    const failure = new Error('synthetic final-link failure')
    let injected = 0
    const client = prisma.$extends({
      query: {
        generatedElementDraft: {
          async updateMany({ args, query }) {
            if (
              args.where?.id === draftId &&
              args.where.revision === 0 &&
              args.where.savedElementId === null &&
              args.data.savedElementId != null &&
              args.data.decision === DB.GeneratedElementDecision.ACCEPTED
            ) {
              injected += 1
              throw failure
            }
            return query(args)
          },
        },
      },
    })
    // Only the final link call fails. The transaction and Element service are real;
    // this proves database rollback, not a SQL constraint or in-memory event rollback.
    await expect(
      keepGeneratedElementDraft(
        keepInput(),
        context(ownerId, client as unknown as DB.PrismaClient)
      )
    ).rejects.toThrow(failure)
    expect(injected).toBe(1)
    expect(await persistedCounts()).toEqual({
      elements: 0,
      tags: 0,
      logs: 0,
      permissions: 0,
    })
    await expectUnchangedDraft()
  })

  it('does not let another entitled owner keep the draft', async () => {
    await expect(
      keepGeneratedElementDraft(keepInput(), context(foreignId))
    ).rejects.toMatchObject({
      code: 'GENERATED_QUESTION_DRAFT_NOT_FOUND',
    })
    expect(await persistedCounts()).toEqual({
      elements: 0,
      tags: 0,
      logs: 0,
      permissions: 0,
    })
    expect(await prisma.element.count({ where: { ownerId: foreignId } })).toBe(
      0
    )
    await expectUnchangedDraft()
  })

  it('denies generated keep without entitlement but preserves manual Element authoring', async () => {
    await prisma.user.update({
      where: { id: ownerId },
      data: { aiFeaturesEnabled: false },
    })
    await expect(
      keepGeneratedElementDraft(keepInput(), context())
    ).rejects.toMatchObject({ extensions: { code: 'AI_BETA_ACCESS_REQUIRED' } })
    expect(await persistedCounts()).toEqual({
      elements: 0,
      tags: 0,
      logs: 0,
      permissions: 0,
    })
    await expectUnchangedDraft()
    const {
      draftId: _draftId,
      expectedRevision: _revision,
      choiceIds: _choices,
      ...input
    } = keepInput()
    await expect(manipulateElement(input, context())).resolves.toMatchObject({
      ownerId,
      name: current.name,
    })
    expect(await persistedCounts()).toEqual({
      elements: 1,
      tags: 1,
      logs: 1,
      permissions: 1,
    })
    await expectUnchangedDraft()
  })
})
