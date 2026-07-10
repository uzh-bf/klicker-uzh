import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AdaptiveEstimateNodeKind,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createCompetenceTree,
  deleteCompetenceTree,
  duplicateCompetenceTree,
  getCompetenceTree,
  getCompetenceTrees,
  getCourseCompetenceTrees,
  linkCompetenceTreeToCourse,
  replaceCompetenceTree,
  unlinkCompetenceTreeFromCourse,
  updateCompetenceTreeMetadata,
  type CompetenceTreeInput,
} from '../src/services/competenceTreeManagement.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

function treeInput(elementId: number): CompetenceTreeInput {
  return {
    name: 'language-skills',
    displayName: 'Language skills',
    description: 'Reusable competence model',
    maxDepth: 5,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.2,
    levelMappingRule: 'NEAREST',
    levels: [
      { key: 'basic', label: 'Basic', order: 0 },
      { key: 'independent', label: 'Independent', order: 1 },
      { key: 'proficient', label: 'Proficient', order: 2 },
    ],
    nodes: [
      {
        key: 'reading',
        kind: 'COMPETENCE',
        name: 'Reading',
        order: 0,
        weight: 2,
      },
      {
        key: 'scanning',
        parentKey: 'reading',
        kind: 'SUBCOMPETENCE',
        name: 'Scanning',
        order: 0,
      },
    ],
    coverages: [
      {
        leafKey: 'scanning',
        levelKey: 'basic',
        targetItemCount: 3,
        enabled: true,
      },
    ],
    assignments: [
      {
        elementId,
        leafKey: 'scanning',
        levelKey: 'basic',
        enabled: true,
        enablePercentInput: false,
      },
    ],
  }
}

describe('competence tree management', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let ownerCtx: ContextWithUser
  let otherCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    ownerCtx = initialized.userOneCtx
    otherCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  async function createSingleChoiceElement(ctx: ContextWithUser) {
    return await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Adaptive SC',
        content: 'Question',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
            { ix: 2, value: 'C', correct: false },
            { ix: 3, value: 'D', correct: false },
          ],
        },
        ownerId: ctx.user.sub,
      },
    })
  }

  it('creates an atomic tree and derives normalized psychometric parameters', async () => {
    const element = await createSingleChoiceElement(ownerCtx)
    const tree = await createCompetenceTree(
      { input: treeInput(element.id) },
      ownerCtx
    )

    expect(tree.validation.valid).toBe(true)
    expect(tree.nodes.map(({ depth }) => depth)).toEqual([1, 2])
    expect(tree.validation.normalizedRootWeights).toEqual([
      { nodeId: tree.nodes[0]!.id, weight: 1 },
    ])
    expect(tree.elementAssignments[0]).toMatchObject({
      elementType: ElementType.SC,
      choiceCount: 4,
      a: 1.2,
      b: -3,
      c: 0.25,
    })

    const trees = await getCompetenceTrees(ownerCtx)
    expect(trees).toHaveLength(1)
    expect(trees[0]).toMatchObject({
      id: tree.id,
      levelCount: 3,
      nodeCount: 2,
      assignmentCount: 1,
      canEdit: true,
    })
  })

  it('keeps failed replacements atomic and owner-only', async () => {
    const element = await createSingleChoiceElement(ownerCtx)
    const tree = await createCompetenceTree(
      { input: treeInput(element.id) },
      ownerCtx
    )
    const invalid = treeInput(element.id)
    invalid.nodes[1]!.parentKey = 'missing'

    await expect(
      replaceCompetenceTree({ id: tree.id, input: invalid }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_INVALID' },
    })

    const tooDeep = treeInput(element.id)
    tooDeep.nodes.push(
      ...['detail', 'inference', 'evaluation', 'transfer'].map(
        (key, index, keys) => ({
          key,
          parentKey: index === 0 ? 'scanning' : keys[index - 1]!,
          kind: 'SUBCOMPETENCE' as const,
          name: key,
          order: 0,
        })
      )
    )
    tooDeep.coverages[0]!.leafKey = 'transfer'
    tooDeep.assignments[0]!.leafKey = 'transfer'
    await expect(
      replaceCompetenceTree({ id: tree.id, input: tooDeep }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_INVALID' },
    })

    await expect(
      replaceCompetenceTree(
        { id: tree.id, input: treeInput(element.id) },
        otherCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })

    const unchanged = await getCompetenceTree({ id: tree.id }, ownerCtx)
    expect(unchanged?.nodes).toHaveLength(2)
    expect(unchanged?.elementAssignments).toHaveLength(1)
  })

  it('reuses trees through courses without granting edit access', async () => {
    const element = await createSingleChoiceElement(ownerCtx)
    const tree = await createCompetenceTree(
      { input: treeInput(element.id) },
      ownerCtx
    )
    const course = await seedCourse({}, ownerCtx)
    const privateCourse = await seedCourse({}, ownerCtx)
    await linkCompetenceTreeToCourse(
      { treeId: tree.id, courseId: course.id },
      ownerCtx
    )
    await linkCompetenceTreeToCourse(
      { treeId: tree.id, courseId: privateCourse.id },
      ownerCtx
    )
    await prisma.derivedPermission.create({
      data: {
        userId: otherCtx.user.sub,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const sharedTrees = await getCourseCompetenceTrees(
      { courseId: course.id },
      otherCtx
    )
    expect(sharedTrees).toHaveLength(1)
    expect(sharedTrees[0]).toMatchObject({
      id: tree.id,
      canEdit: false,
      isOwner: false,
    })
    expect(sharedTrees[0]!.courseLinks.map(({ courseId }) => courseId)).toEqual(
      [course.id]
    )
    const sharedDetail = await getCompetenceTree({ id: tree.id }, otherCtx)
    expect(sharedDetail?.courseLinks.map(({ courseId }) => courseId)).toEqual([
      course.id,
    ])
    expect(sharedDetail?.elementAssignments[0]).toMatchObject({
      elementId: element.id,
      elementName: 'Adaptive SC',
      elementType: ElementType.SC,
    })

    await expect(
      duplicateCompetenceTree({ id: tree.id }, otherCtx)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })

    await prisma.derivedPermission.create({
      data: {
        userId: otherCtx.user.sub,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const duplicate = await duplicateCompetenceTree({ id: tree.id }, otherCtx)
    expect(duplicate.ownerId).toBe(otherCtx.user.sub)
    expect(duplicate.courseLinks).toEqual([])

    await expect(
      unlinkCompetenceTreeFromCourse(
        { treeId: tree.id, courseId: course.id },
        otherCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
  })

  it('locks structure after quiz use while allowing metadata and soft deletion', async () => {
    const element = await createSingleChoiceElement(ownerCtx)
    const tree = await createCompetenceTree(
      { input: treeInput(element.id) },
      ownerCtx
    )
    const course = await seedCourse({}, ownerCtx)
    const quiz = await prisma.practiceQuiz.create({
      data: {
        name: 'adaptive-practice',
        displayName: 'Adaptive practice',
        ownerId: ownerCtx.user.sub,
        courseId: course.id,
      },
    })
    const config = await prisma.practiceQuizAdaptiveConfig.create({
      data: {
        practiceQuizId: quiz.id,
        competenceTreeId: tree.id,
      },
    })

    const participant = await prisma.participant.create({
      data: {
        username: 'adaptive-estimate-participant',
        password: 'test-password',
      },
    })
    const participation = await prisma.participation.create({
      data: { courseId: course.id, participantId: participant.id },
    })
    const attempt = await prisma.adaptivePracticeQuizAttempt.create({
      data: {
        configId: config.id,
        practiceQuizId: quiz.id,
        courseId: course.id,
        participantId: participant.id,
        participationId: participation.id,
      },
    })

    await expect(
      prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          nodeKind: AdaptiveEstimateNodeKind.COMPETENCE,
          nodeId: null,
          theta: 0,
          standardError: 1,
          responseCount: 1,
        },
      })
    ).rejects.toBeTruthy()
    await prisma.adaptivePracticeQuizEstimate.create({
      data: {
        attemptId: attempt.id,
        nodeKind: AdaptiveEstimateNodeKind.OVERALL,
        nodeId: null,
        theta: 0,
        standardError: 1,
        responseCount: 1,
      },
    })
    await expect(
      prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          nodeKind: AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: 0.1,
          standardError: 0.9,
          responseCount: 2,
        },
      })
    ).rejects.toBeTruthy()

    await expect(
      replaceCompetenceTree(
        { id: tree.id, input: treeInput(element.id) },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_STRUCTURE_LOCKED' },
    })

    const renamed = await updateCompetenceTreeMetadata(
      {
        id: tree.id,
        input: {
          name: 'renamed-tree',
          displayName: 'Renamed tree',
          description: null,
        },
      },
      ownerCtx
    )
    expect(renamed.displayName).toBe('Renamed tree')
    expect(renamed.isStructurallyLocked).toBe(true)

    await expect(deleteCompetenceTree({ id: tree.id }, ownerCtx)).resolves.toBe(
      true
    )
    expect(
      await prisma.competenceTree.findUnique({ where: { id: tree.id } })
    ).toMatchObject({ isDeleted: true })
  })

  it('enforces same-tree hierarchy references in the database', async () => {
    const element = await createSingleChoiceElement(ownerCtx)
    const first = await createCompetenceTree(
      { input: treeInput(element.id) },
      ownerCtx
    )
    const second = await createCompetenceTree(
      {
        input: {
          ...treeInput(element.id),
          name: 'second-tree',
          displayName: 'Second tree',
        },
      },
      ownerCtx
    )

    await expect(
      prisma.competenceTreeLeafLevelCoverage.create({
        data: {
          treeId: first.id,
          leafNodeId: second.nodes[1]!.id,
          levelId: first.levels[0]!.id,
          targetItemCount: 1,
        },
      })
    ).rejects.toBeTruthy()

    await expect(
      prisma.competenceTreeNode.create({
        data: {
          treeId: first.id,
          kind: 'COMPETENCE',
          name: 'Duplicate root order',
          order: 0,
          depth: 1,
        },
      })
    ).rejects.toBeTruthy()
  })
})
