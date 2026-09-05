import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedFlashcard,
  GeneratedQuestionWithProvenance,
  QuestionGenerationArtifactRef,
  QuestionGenerationItemType,
} from '@klicker-uzh/types'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { acquireElementGenerationLease } from '../src/services/elementGenerationLease.js'
import { persistInitialGeneratedFlashcardDrafts } from '../src/services/flashcardGenerationDrafts.js'
import { persistInitialGeneratedQuestionDrafts } from '../src/services/questionGenerationDrafts.js'

const NOW = new Date('2026-09-05T10:00:00Z')
const artifact: QuestionGenerationArtifactRef = {
  containerName: 'synthetic',
  blobName: 'completion/result.json',
  sha256: 'a'.repeat(64),
}
const card: GeneratedFlashcard = {
  sourceFlashcardId: 'card-1',
  name: ' Synthetic card ',
  front: ' Front ',
  back: ' Back ',
  cardType: 'definition',
  tags: ['topic', 'topic'],
}
function question(
  itemType: QuestionGenerationItemType = 'SC'
): GeneratedQuestionWithProvenance {
  return {
    sourceQuestionId: 'question-1',
    itemType,
    name: 'Synthetic question',
    stem: 'Choose the correct answer',
    context: null,
    explanation: 'Explanation',
    choices: Array.from(
      { length: itemType === 'MC' ? 5 : itemType === 'KPRIM' ? 4 : 2 },
      (_, index) => ({
        id: `choice-${index}`,
        label: String(index),
        text: `Answer ${index}`,
        correct: index === 0,
        feedback: null,
      })
    ),
    bloomLevel: 'remember',
    targetDifficulty: 1,
    predictedDifficulty: 1.5,
    qualityFlags: ['synthetic-review'],
    citations: [
      {
        resourceId: 'synthetic-resource',
        sourceFile: 'synthetic.md',
        pageFrom: 1,
        pageTo: 2,
        chunkIds: ['chunk-1'],
      },
    ],
    provenance: {
      schemaVersion: 1,
      lineageStatus: 'complete',
      graphVersionId: 'synthetic-graph',
      bundleSha256: 'b'.repeat(64),
      graphSha256: 'c'.repeat(64),
      domainPolicyDigest: null,
      generationRecipeDigest: null,
      nodeIds: ['node-1'],
      relationshipIds: [],
      sourceCitations: [],
      assertionCitations: [],
    },
  }
}
type Variant = 'question' | 'flashcard'
const variants: Variant[] = ['question', 'flashcard']
const flashStates = [
  DB.ElementGenerationBuildStatus.QUEUED,
  DB.ElementGenerationBuildStatus.RUNNING,
  DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
]
const flashResults = [
  'completed',
  'completed_with_review',
  'incomplete',
] as const
let ownerId: string
let graphBuildId: string

function context(client = prisma) {
  return { prisma: client } as unknown as ContextWithUser
}
function complete(
  variant: Variant,
  buildId: string,
  leaseOwner: string,
  ctx = context()
) {
  return variant === 'question'
    ? persistInitialGeneratedQuestionDrafts(
        {
          buildId,
          leaseOwner,
          questions: [{ ...question(), provenance: null }],
          resultManifestArtifact: artifact,
          finalBankArtifact: artifact,
          questionProvenanceIndexArtifact: null,
        },
        ctx
      )
    : persistInitialGeneratedFlashcardDrafts(
        {
          buildId,
          leaseOwner,
          cards: [card],
          resultStatus: 'completed',
          unresolvedElementCount: 0,
          warningCount: 0,
          resultManifestArtifact: artifact,
          finalBankArtifact: artifact,
          checkpointArtifact: null,
        },
        ctx
      )
}
function leaseError(variant: Variant) {
  return {
    message:
      variant === 'question'
        ? 'Question-generation build completion lost its lease'
        : 'Flashcard build completion lost its lease',
    code: 'CONCURRENT_MODIFICATION',
  }
}
async function createBuild(
  variant: Variant,
  data: Partial<DB.Prisma.ElementGenerationBuildUncheckedCreateInput> = {}
) {
  return prisma.elementGenerationBuild.create({
    data: {
      id: randomUUID(),
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType:
        variant === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
      configuration: {} as never,
      configurationHash: 'synthetic-completion',
      idempotencyKey: randomUUID(),
      requestedElementCount: 1,
      status:
        variant === 'question'
          ? DB.ElementGenerationBuildStatus.FINALIZING
          : DB.ElementGenerationBuildStatus.RUNNING,
      syncLeaseOwner: randomUUID(),
      syncLeaseUntil: NOW,
      ...data,
    },
  })
}
async function snapshot(buildId: string) {
  return {
    build: await prisma.elementGenerationBuild.findUniqueOrThrow({
      where: { id: buildId },
    }),
    drafts: await prisma.generatedElementDraft.findMany({
      where: { buildId },
      orderBy: { id: 'asc' },
    }),
    spends: await prisma.elementGenerationSpend.findMany({
      where: { buildId },
      orderBy: { id: 'asc' },
    }),
    quotas: await prisma.kBGraphQuota.findMany({
      where: { ownerId },
      orderBy: { id: 'asc' },
    }),
  }
}
async function existingDraft(
  buildId: string,
  variant: Variant,
  duplicationIndex = 0
) {
  const { provenance, ...original } = question()
  return prisma.generatedElementDraft.create({
    data: {
      buildId,
      sourceElementId: variant === 'question' ? 'question-1' : 'card-1',
      order: 0,
      duplicationIndex,
      elementType:
        variant === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
      original: variant === 'question' ? original : card,
      current:
        variant === 'question'
          ? { ...original, name: 'Previously edited' }
          : { ...card, name: 'Previously edited' },
      citations: [],
      provenance: provenance ?? DB.Prisma.DbNull,
      revision: 3,
    },
  })
}
function signal() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Completion barrier timed out')),
          3000
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

describe('initial Element completion', () => {
  beforeEach(async () => {
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `completion-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Synthetic completion KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `synthetic:${graphBuildId}`,
      },
    })
  })
  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it.each([
    'SC',
    'MC',
    'KPRIM',
  ] as const)('preserves %s content and provenance when completing a build', async (itemType) => {
    const build = await createBuild('question', { elementType: itemType })
    const generated = question(itemType)
    const {
      provenance,
      sourceQuestionId,
      bloomLevel,
      targetDifficulty,
      predictedDifficulty,
      qualityFlags,
      citations,
      ...current
    } = generated
    const { provenance: _provenance, ...original } = generated
    await persistInitialGeneratedQuestionDrafts(
      {
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        questions: [generated],
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        questionProvenanceIndexArtifact: artifact,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.drafts).toHaveLength(1)
    expect(after.drafts[0]).toMatchObject({
      sourceElementId: sourceQuestionId,
      elementType: itemType,
      original,
      current,
      provenance,
      bloomLevel,
      targetDifficulty,
      predictedDifficulty,
      qualityFlags,
      citations,
      duplicationIndex: 0,
      revision: 0,
      decision: 'OPEN',
      savedElementId: null,
    })
    expect(after.build).toMatchObject({
      status: 'COMPLETED',
      stage: 'completed',
      generatedElementCount: 1,
      resultManifestArtifact: artifact,
      finalBankArtifact: artifact,
      provenanceIndexArtifact: artifact,
      completedAt: expect.any(Date),
      lastSynchronizedAt: expect.any(Date),
    })
    expect(after.spends).toEqual([])
    expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
  })

  it.each(
    flashStates.flatMap((status) =>
      flashResults.map((resultStatus) => ({ status, resultStatus }))
    )
  )('accepts flashcard $status with $resultStatus', async ({
    status,
    resultStatus,
  }) => {
    const build = await createBuild('flashcard', { status })
    await persistInitialGeneratedFlashcardDrafts(
      {
        buildId: build.id,
        leaseOwner: build.syncLeaseOwner!,
        cards: [card],
        resultStatus,
        unresolvedElementCount: 2,
        warningCount: 3,
        resultManifestArtifact: artifact,
        finalBankArtifact: artifact,
        checkpointArtifact: artifact,
      },
      context()
    )
    const after = await snapshot(build.id)
    expect(after.build).toMatchObject({
      status: resultStatus === 'incomplete' ? 'INCOMPLETE' : 'COMPLETED',
      stage: resultStatus === 'incomplete' ? 'incomplete' : 'completed',
      generatedElementCount: 1,
      unresolvedElementCount: 2,
      warningCount: 3,
      resultManifestArtifact: artifact,
      finalBankArtifact: artifact,
      checkpointArtifact: artifact,
      completedAt: expect.any(Date),
      lastSynchronizedAt: expect.any(Date),
    })
    expect(after.drafts).toHaveLength(1)
    expect(after.drafts[0]).toMatchObject({
      elementType: 'FLASHCARD',
      original: card,
      current: {
        name: 'Synthetic card',
        front: 'Front',
        back: 'Back',
        cardType: 'definition',
        tags: ['generated-flashcard', 'flashcard:definition', 'topic'],
      },
      citations: [],
      provenance: null,
      duplicationIndex: 0,
      revision: 0,
      qualityFlags: [],
      bloomLevel: null,
      targetDifficulty: null,
      predictedDifficulty: null,
      savedElementId: null,
    })
  })

  it.each(
    variants.flatMap((variant) =>
      ['lease', 'state', 'type'].map((invalid) => ({ variant, invalid }))
    )
  )('rejects $variant completion with invalid $invalid without writes', async ({
    variant,
    invalid,
  }) => {
    const build = await createBuild(variant, {
      ...(invalid === 'state'
        ? { status: DB.ElementGenerationBuildStatus.FAILED }
        : {}),
      ...(invalid === 'type'
        ? {
            elementType:
              variant === 'question'
                ? DB.ElementType.FLASHCARD
                : DB.ElementType.SC,
          }
        : {}),
    })
    const before = await snapshot(build.id)
    await expect(
      complete(
        variant,
        build.id,
        invalid === 'lease' ? randomUUID() : build.syncLeaseOwner!
      )
    ).rejects.toMatchObject(leaseError(variant))
    expect(await snapshot(build.id)).toEqual(before)
  })

  it('rejects a mismatched question item type before inserting drafts', async () => {
    const build = await createBuild('question', {
      elementType: DB.ElementType.MC,
    })
    const before = await snapshot(build.id)
    await expect(
      complete('question', build.id, build.syncLeaseOwner!)
    ).rejects.toMatchObject({
      message:
        'Generated question types do not match the requested element type',
      code: 'DRAFT_INVALID',
    })
    expect(await snapshot(build.id)).toEqual(before)
  })

  it.each(
    variants
  )('preserves a matching existing %s draft on re-entry', async (variant) => {
    const build = await createBuild(variant, {
      provenanceIndexArtifact: artifact,
      checkpointArtifact: artifact,
    })
    const draft = await existingDraft(build.id, variant)
    await complete(variant, build.id, build.syncLeaseOwner!)
    const after = await snapshot(build.id)
    expect(after.drafts).toEqual([draft])
    expect(after.build.status).toBe(DB.ElementGenerationBuildStatus.COMPLETED)
    expect(
      variant === 'question'
        ? after.build.provenanceIndexArtifact
        : after.build.checkpointArtifact
    ).toBeNull()
  })

  it.each(
    variants
  )('preserves the %s duplicate-counting rule and rolls back invalid cardinality', async (variant) => {
    const build = await createBuild(variant)
    const draft = await existingDraft(build.id, variant, 1)
    const before = await snapshot(build.id)
    if (variant === 'question') {
      await complete(variant, build.id, build.syncLeaseOwner!)
      const after = await snapshot(build.id)
      expect(after.drafts).toHaveLength(2)
      expect(after.drafts).toContainEqual(draft)
      expect(
        after.drafts.find((row) => row.duplicationIndex === 0)?.provenance
      ).toBeNull()
      expect(after.build.generatedElementCount).toBe(1)
    } else {
      await expect(
        complete(variant, build.id, build.syncLeaseOwner!)
      ).rejects.toMatchObject({
        message: 'Generated flashcard count does not match the bank',
        code: 'DRAFT_INVALID',
      })
      expect(await snapshot(build.id)).toEqual(before)
    }
  })

  it('rolls back newly inserted questions when original-draft cardinality is wrong', async () => {
    const build = await createBuild('question')
    const existing = await existingDraft(build.id, 'question')
    await prisma.generatedElementDraft.update({
      where: { id: existing.id },
      data: { sourceElementId: 'different-original' },
    })
    const before = await snapshot(build.id)
    await expect(
      complete('question', build.id, build.syncLeaseOwner!)
    ).rejects.toMatchObject({
      message: 'Generated draft count does not match the final bank',
      code: 'DRAFT_INVALID',
    })
    expect(await snapshot(build.id)).toEqual(before)
  })

  it.each(
    variants
  )('rolls back %s drafts after a real post-read lease takeover', async (variant) => {
    const build = await createBuild(variant)
    const quota = await prisma.kBGraphQuota.create({
      data: {
        ownerId,
        semesterKey: 'synthetic-completion',
        currency: 'CHF',
        limitMinorUnits: 100,
        reservedMinorUnits: 20,
      },
    })
    await prisma.elementGenerationSpend.create({
      data: {
        buildId: build.id,
        quotaId: quota.id,
        dispatchAttemptId: randomUUID(),
        spendClass:
          variant === 'question'
            ? DB.KBGraphQuotaSpendClass.QUESTION_GENERATION
            : DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
        semesterKey: quota.semesterKey,
        estimatedCostMinorUnits: 20,
        costCurrency: 'CHF',
        costPricingVersion: 'synthetic',
        dispatchClaimedAt: NOW,
      },
    })
    const arrived = signal()
    const release = signal()
    let completionPid: number | undefined
    const queryClient = prisma.$extends({
      query: {
        elementGenerationBuild: {
          async findFirst({ args, query }) {
            const result = await query(args)
            if (args.where?.id === build.id) {
              arrived.resolve()
              await bounded(release.promise)
            }
            return result
          },
        },
      },
    })
    // Observe the real transaction connection; delegate its entire lifetime to Prisma.
    const client = queryClient.$extends({
      client: {
        async $transaction<T>(
          operation: (transaction: DB.Prisma.TransactionClient) => Promise<T>
        ) {
          return queryClient.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw<
              Array<{ pid: number }>
            >`SELECT pg_backend_pid() AS pid`
            completionPid = rows[0]!.pid
            return operation(
              transaction as unknown as DB.Prisma.TransactionClient
            )
          })
        },
      },
    })
    // Attach rejection handling immediately so a failed scheduling assertion cannot leak it.
    const pending = complete(
      variant,
      build.id,
      build.syncLeaseOwner!,
      context(client as unknown as DB.PrismaClient)
    ).then(
      () => null,
      (error: unknown) => error
    )
    try {
      await bounded(arrived.promise)
      const successor = await prisma.$transaction(async (transaction) => {
        const rows = await transaction.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`
        const token = await acquireElementGenerationLease(transaction, {
          buildId: build.id,
          ownerId,
          now: new Date(NOW.getTime() + 1),
        })
        return { pid: rows[0]!.pid, token }
      })
      expect(completionPid).toEqual(expect.any(Number))
      expect(successor.pid).not.toBe(completionPid)
      expect(successor.token).toEqual(expect.any(String))
      const winner = await snapshot(build.id)
      release.resolve()
      expect(await bounded(pending)).toMatchObject(leaseError(variant))
      expect(await snapshot(build.id)).toEqual(winner)
      expect(winner.drafts).toEqual([])
      expect(winner.build.syncLeaseOwner).toBe(successor.token)
      expect(await prisma.element.count({ where: { ownerId } })).toBe(0)
    } finally {
      release.resolve()
      await pending
    }
  })
})
