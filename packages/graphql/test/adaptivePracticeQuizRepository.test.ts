import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import {
  persistAdaptivePracticeQuizEstimates,
  type PersistAdaptivePracticeQuizEstimatesInput,
} from '../src/services/adaptivePracticeQuizRepository.js'
import { createLegacyAdaptivePublicationFixture } from './adaptivePracticeQuizTestHelpers.js'

describe('adaptive practice quiz estimate repository', () => {
  beforeEach(cleanDatabase)
  afterEach(cleanDatabase)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('inserts and updates overall and node estimates without duplicates', async () => {
    const fixture = await createFixture(2)
    const baseInput = estimateInput(fixture)
    const initial: PersistAdaptivePracticeQuizEstimatesInput = {
      ...baseInput,
      nodes: baseInput.nodes.map((estimate, index) =>
        index === 1
          ? {
              ...estimate,
              theta: null,
              standardError: null,
              responseCount: 0,
              levelId: null,
              stopReason: null,
            }
          : estimate
      ),
    }

    await prisma.$transaction((tx) =>
      persistAdaptivePracticeQuizEstimates(initial, tx)
    )

    const inserted = await prisma.adaptivePracticeQuizEstimate.findMany({
      where: { attemptId: fixture.attemptId },
      orderBy: { id: 'asc' },
    })
    expect(inserted).toHaveLength(3)
    expect(
      inserted.filter(
        ({ nodeKind, nodeId }) =>
          nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL && nodeId === null
      )
    ).toHaveLength(1)
    expect(
      persistedFields(
        requireEstimate(inserted, DB.AdaptiveEstimateNodeKind.OVERALL, null)
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...initial.overall,
    })
    expect(
      persistedFields(
        requireEstimate(
          inserted,
          initial.nodes[0]!.nodeKind,
          initial.nodes[0]!.nodeId
        )
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...initial.nodes[0],
    })
    expect(
      persistedFields(
        requireEstimate(
          inserted,
          initial.nodes[1]!.nodeKind,
          initial.nodes[1]!.nodeId
        )
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...initial.nodes[1],
    })

    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: fixture.attemptId },
      data: {
        stopReason: DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED,
      },
    })
    const updated: PersistAdaptivePracticeQuizEstimatesInput = {
      ...initial,
      overall: {
        ...initial.overall,
        theta: 0.75,
        standardError: 0.45,
        responseCount: 4,
        stopReason: DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED,
      },
      nodes: initial.nodes.map((estimate, index) => ({
        ...estimate,
        theta: index === 0 ? 0.6 : -0.25,
        standardError: index === 0 ? 0.5 : 0.9,
        responseCount: index + 2,
        levelId: fixture.levelId,
        stopReason:
          index === 0
            ? DB.AdaptivePracticeQuizStopReason.CLASSIFIED
            : DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED,
      })),
    }

    await prisma.$transaction((tx) =>
      persistAdaptivePracticeQuizEstimates(updated, tx)
    )

    const persisted = await prisma.adaptivePracticeQuizEstimate.findMany({
      where: { attemptId: fixture.attemptId },
      orderBy: { id: 'asc' },
    })
    expect(persisted).toHaveLength(3)
    expect(estimateIdsByIdentity(persisted)).toEqual(
      estimateIdsByIdentity(inserted)
    )
    expect(
      persistedFields(
        requireEstimate(persisted, DB.AdaptiveEstimateNodeKind.OVERALL, null)
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...updated.overall,
    })
    expect(
      persistedFields(
        requireEstimate(
          persisted,
          updated.nodes[0]!.nodeKind,
          updated.nodes[0]!.nodeId
        )
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...updated.nodes[0],
    })
    expect(
      persistedFields(
        requireEstimate(
          persisted,
          updated.nodes[1]!.nodeKind,
          updated.nodes[1]!.nodeId
        )
      )
    ).toEqual({
      attemptId: fixture.attemptId,
      configId: fixture.configId,
      competenceTreeId: fixture.competenceTreeId,
      ...updated.nodes[1],
    })
  })

  it('persists the 500-node guardrail in three statements', async () => {
    const fixture = await createFixture(500)
    const input = estimateInput(fixture)

    await prisma.$transaction(async (tx) => {
      const executeRaw = vi.fn((query: DB.Prisma.Sql) => tx.$executeRaw(query))
      const countingTx = {
        $executeRaw: executeRaw,
      } as unknown as DB.Prisma.TransactionClient

      await persistAdaptivePracticeQuizEstimates(input, countingTx)

      expect(executeRaw).toHaveBeenCalledTimes(3)
    })

    expect(
      await prisma.adaptivePracticeQuizEstimate.count({
        where: { attemptId: fixture.attemptId },
      })
    ).toBe(501)
  })

  it('rolls every estimate back with the caller transaction', async () => {
    const fixture = await createFixture(2)
    const input = estimateInput(fixture)

    await expect(
      prisma.$transaction(async (tx) => {
        await persistAdaptivePracticeQuizEstimates(input, tx)
        expect(
          await tx.adaptivePracticeQuizEstimate.count({
            where: { attemptId: fixture.attemptId },
          })
        ).toBe(3)
        throw new Error('force repository rollback')
      })
    ).rejects.toThrow('force repository rollback')

    expect(
      await prisma.adaptivePracticeQuizEstimate.count({
        where: { attemptId: fixture.attemptId },
      })
    ).toBe(0)
  })
})

async function cleanDatabase() {
  await prisma.$executeRaw`
    TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE
  `
}

async function createFixture(nodeCount: number) {
  const suffix = randomUUID()
  const owner = await prisma.user.create({
    data: {
      email: `adaptive-repository-${suffix}@example.com`,
      shortname: `adaptive-repository-${suffix}`,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: `adaptive-repository-course-${suffix}`,
      displayName: 'Adaptive repository course',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
      pinCode: 6543,
      ownerId: owner.id,
      isAdaptiveLearningEnabled: true,
    },
  })
  const tree = await prisma.competenceTree.create({
    data: {
      name: `adaptive-repository-tree-${suffix}`,
      displayName: 'Adaptive repository tree',
      ownerId: owner.id,
    },
  })
  const level = await prisma.competenceTreeLevel.create({
    data: {
      treeId: tree.id,
      label: 'Repository level',
      order: 0,
    },
  })
  const root = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Repository root',
      order: 0,
      depth: 0,
    },
  })
  if (nodeCount > 1) {
    await prisma.competenceTreeNode.createMany({
      data: Array.from({ length: nodeCount - 1 }, (_, index) => ({
        treeId: tree.id,
        kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
        name: `Repository node ${index + 1}`,
        order: index,
        depth: 1,
        parentId: root.id,
      })),
    })
  }
  const nodes = await prisma.competenceTreeNode.findMany({
    where: { treeId: tree.id },
    orderBy: { id: 'asc' },
  })
  await prisma.competenceTreeCourse.create({
    data: { treeId: tree.id, courseId: course.id, linkedById: owner.id },
  })
  const element = await prisma.element.create({
    data: {
      ownerId: owner.id,
      type: DB.ElementType.SC,
      name: 'Repository item',
      content: 'Repository item',
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Incorrect', correct: false },
        ],
      },
    },
  })
  const assignment = await prisma.competenceTreeElementAssignment.create({
    data: {
      treeId: tree.id,
      elementId: element.id,
      leafNodeId: nodes.at(-1)!.id,
      levelId: level.id,
    },
  })
  await prisma.competenceTreeLeafLevelCoverage.create({
    data: {
      treeId: tree.id,
      leafNodeId: assignment.leafNodeId,
      levelId: level.id,
      targetItemCount: 1,
    },
  })
  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `adaptive-repository-quiz-${suffix}`,
      displayName: 'Adaptive repository quiz',
      ownerId: owner.id,
      courseId: course.id,
      mode: DB.PracticeQuizMode.ADAPTIVE,
      status: DB.PublicationStatus.PUBLISHED,
      pointsMultiplier: 0,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
    },
  })
  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId: practiceQuiz.id,
      competenceTreeId: tree.id,
      poolPublishedAt: new Date(),
    },
  })
  const { publication } = await createLegacyAdaptivePublicationFixture({
    configId: config.id,
    publishedById: owner.id,
  })
  const participant = await prisma.participant.create({
    data: {
      username: `adaptive-repository-${suffix}`,
      password: 'test-only',
    },
  })
  const participation = await prisma.participation.create({
    data: {
      courseId: course.id,
      participantId: participant.id,
    },
  })
  const attempt = await prisma.adaptivePracticeQuizAttempt.create({
    data: {
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
      completedAt: new Date(),
      publicationId: publication.id,
      scaleVersionId: publication.scaleVersionId,
      measurementVersion: publication.measurementVersion,
      estimatorImplementationVersion:
        publication.estimatorImplementationVersion,
      classificationPolicyVersion: publication.classificationPolicyVersion,
      calibrationPolicyVersion: publication.calibrationPolicyVersion,
      configId: config.id,
      competenceTreeId: tree.id,
      practiceQuizId: practiceQuiz.id,
      courseId: course.id,
      participantId: participant.id,
      participationId: participation.id,
    },
  })

  return {
    attemptId: attempt.id,
    configId: config.id,
    competenceTreeId: tree.id,
    levelId: level.id,
    nodes,
  }
}

function estimateInput(
  fixture: Awaited<ReturnType<typeof createFixture>>
): PersistAdaptivePracticeQuizEstimatesInput {
  return {
    attemptId: fixture.attemptId,
    configId: fixture.configId,
    competenceTreeId: fixture.competenceTreeId,
    overall: {
      nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      nodeId: null,
      theta: 0.25,
      standardError: 0.8,
      responseCount: 2,
      levelId: fixture.levelId,
      stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
    },
    nodes: fixture.nodes.map((node, index) => ({
      nodeKind:
        node.kind === DB.AdaptiveNodeKind.COMPETENCE
          ? DB.AdaptiveEstimateNodeKind.COMPETENCE
          : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
      nodeId: node.id,
      theta: ((index % 7) - 3) / 10,
      standardError: 0.5 + (index % 5) / 10,
      responseCount: 2,
      levelId: fixture.levelId,
      stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
    })),
  }
}

function persistedFields(estimate: DB.AdaptivePracticeQuizEstimate) {
  return {
    attemptId: estimate.attemptId,
    configId: estimate.configId,
    competenceTreeId: estimate.competenceTreeId,
    nodeKind: estimate.nodeKind,
    nodeId: estimate.nodeId,
    theta: estimate.theta,
    standardError: estimate.standardError,
    responseCount: estimate.responseCount,
    levelId: estimate.levelId,
    stopReason: estimate.stopReason,
  }
}

function requireEstimate(
  estimates: DB.AdaptivePracticeQuizEstimate[],
  nodeKind: DB.AdaptiveEstimateNodeKind,
  nodeId: number | null
) {
  const estimate = estimates.find(
    (entry) => entry.nodeKind === nodeKind && entry.nodeId === nodeId
  )
  if (!estimate) {
    throw new Error(`Missing ${nodeKind} estimate for node ${nodeId}`)
  }
  return estimate
}

function estimateIdsByIdentity(
  estimates: DB.AdaptivePracticeQuizEstimate[]
): Record<string, number> {
  return Object.fromEntries(
    estimates.map(({ id, nodeKind, nodeId }) => [`${nodeKind}:${nodeId}`, id])
  )
}
