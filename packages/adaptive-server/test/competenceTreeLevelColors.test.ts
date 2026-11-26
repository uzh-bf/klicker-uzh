import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from '@klicker-uzh/adaptive-test-host/helpers'
import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import { ElementType, type PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { serializeLevelBands } from '../src/services/adaptivePracticeQuizLegacyLevelScale.js'
import { prepareTreeInput } from '../src/services/competenceTreeInput.js'
import {
  competenceTreeLevelColorsById,
  normalizeCompetenceTreeLevelColor,
} from '../src/services/competenceTreeLevelColors.js'
import {
  type CompetenceTreeInput,
  createCompetenceTree,
  duplicateCompetenceTree,
  replaceCompetenceTree,
  updateCompetenceTreeMetadata,
} from '../src/services/competenceTreeManagement.js'

function treeInput(
  elementId: number,
  colors: Array<string | null | undefined> = []
): CompetenceTreeInput {
  return {
    name: 'colored-tree',
    displayName: 'Colored tree',
    levels: ['Basic', 'Independent', 'Proficient'].map((label, order) => ({
      key: `level-${order}`,
      label,
      order,
      color: colors[order],
    })),
    nodes: [
      { key: 'reading', kind: 'COMPETENCE', name: 'Reading', order: 0 },
      {
        key: 'scanning',
        parentKey: 'reading',
        kind: 'SUBCOMPETENCE',
        name: 'Scanning',
        order: 0,
      },
    ],
    coverages: [0, 1, 2].map((order) => ({
      leafKey: 'scanning',
      levelKey: `level-${order}`,
      targetItemCount: 1,
      enabled: true,
    })),
    assignments: [
      {
        elementId,
        leafKey: 'scanning',
        levelKey: 'level-0',
        enabled: true,
        enablePercentInput: false,
      },
    ],
  }
}

describe('competence tree level color validation', () => {
  it('accepts #RRGGBB in any case, clears blanks, and rejects other values', () => {
    expect(normalizeCompetenceTreeLevelColor('#AbCdEf')).toBe('#abcdef')
    expect(normalizeCompetenceTreeLevelColor(' #00ff88 ')).toBe('#00ff88')
    expect(normalizeCompetenceTreeLevelColor(null)).toBeNull()
    expect(normalizeCompetenceTreeLevelColor(undefined)).toBeNull()
    expect(normalizeCompetenceTreeLevelColor('')).toBeNull()
    for (const invalid of [
      '#fff',
      'ffffff',
      '#gggggg',
      '#ffffff00',
      'red',
      'rgb(0,0,0)',
      '#12345',
    ]) {
      expect(() => normalizeCompetenceTreeLevelColor(invalid)).toThrow(
        expect.objectContaining({
          extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' },
        })
      )
    }
  })

  it('normalizes level colors in tree input before validation and persistence', () => {
    const prepared = prepareTreeInput(treeInput(1, ['#AABBCC', null]))
    expect(prepared.levels.map(({ color }) => color)).toEqual([
      '#aabbcc',
      null,
      null,
    ])
    expect(() => prepareTreeInput(treeInput(1, ['blue']))).toThrow(
      expect.objectContaining({
        extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' },
      })
    )
  })

  it('adds live tree colors to legacy level bands by source level id', () => {
    const bands = serializeLevelBands(
      [
        { id: 7, label: 'Low', order: 0 },
        { id: 8, label: 'High', order: 1 },
      ],
      {
        totalQuestionCap: 10,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 1,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        levelMappingRule: 'NEAREST',
        thetaRange: { min: -3, max: 3 },
      },
      competenceTreeLevelColorsById([
        { id: 7, color: null },
        { id: 8, color: '#ff8800' },
      ])
    )
    expect(bands.map(({ label, color }) => ({ label, color }))).toEqual([
      { label: 'Low', color: null },
      { label: 'High', color: '#ff8800' },
    ])
  })
})

describe('competence tree level color persistence', () => {
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
    await testCleanup(prisma)
    const initialized = await testInitialization(prisma, hatchet, emitter)
    ownerCtx = initialized.userOneCtx
    otherCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  async function createElement(ctx: ContextWithUser) {
    return await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Colored SC',
        content: 'Question',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
        },
        ownerId: ctx.user.sub,
      },
    })
  }

  it('saves, replaces, clears, and duplicates level colors with the tree', async () => {
    const element = await createElement(ownerCtx)
    const tree = await createCompetenceTree(
      { input: treeInput(element.id, ['#FFAA00', null, '#123456']) },
      ownerCtx
    )
    expect(tree.levels.map(({ color }) => color)).toEqual([
      '#ffaa00',
      null,
      '#123456',
    ])

    const replaced = await replaceCompetenceTree(
      { id: tree.id, input: treeInput(element.id, [null, '#00ff00']) },
      ownerCtx
    )
    expect(replaced.levels.map(({ color }) => color)).toEqual([
      null,
      '#00ff00',
      null,
    ])

    const copy = await duplicateCompetenceTree(
      { id: tree.id, input: null },
      ownerCtx
    )
    expect(copy.levels.map(({ color }) => color)).toEqual([
      null,
      '#00ff00',
      null,
    ])

    await expect(
      prisma.competenceTreeLevel.update({
        where: { id: replaced.levels[0]!.id },
        data: { color: '#ABCDEF' },
      })
    ).rejects.toBeTruthy()
  })

  it('edits colors of a structurally locked tree without a structure change', async () => {
    const element = await createElement(ownerCtx)
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
    await prisma.practiceQuizAdaptiveConfig.create({
      data: { practiceQuizId: quiz.id, competenceTreeId: tree.id },
    })
    const before = await prisma.competenceTree.findUniqueOrThrow({
      where: { id: tree.id },
      include: {
        levels: { orderBy: { order: 'asc' } },
        nodes: true,
        levelCoverages: true,
        elementAssignments: true,
      },
    })

    await expect(
      replaceCompetenceTree(
        { id: tree.id, input: treeInput(element.id, ['#ff0000']) },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_STRUCTURE_LOCKED' },
    })

    const [low, middle, high] = tree.levels
    const updated = await updateCompetenceTreeMetadata(
      {
        id: tree.id,
        input: {
          name: tree.name,
          displayName: tree.displayName,
          levelColors: [
            { levelId: low!.id, color: '#FF0000' },
            { levelId: high!.id, color: '#0000ff' },
          ],
        },
      },
      ownerCtx
    )
    expect(updated.isStructurallyLocked).toBe(true)
    expect(updated.levels.map(({ color }) => color)).toEqual([
      '#ff0000',
      null,
      '#0000ff',
    ])

    // Omitted levels keep their color; null clears one override.
    const cleared = await updateCompetenceTreeMetadata(
      {
        id: tree.id,
        input: {
          name: tree.name,
          displayName: tree.displayName,
          levelColors: [{ levelId: low!.id, color: null }],
        },
      },
      ownerCtx
    )
    expect(cleared.levels.map(({ color }) => color)).toEqual([
      null,
      null,
      '#0000ff',
    ])

    const after = await prisma.competenceTree.findUniqueOrThrow({
      where: { id: tree.id },
      include: {
        levels: { orderBy: { order: 'asc' } },
        nodes: true,
        levelCoverages: true,
        elementAssignments: true,
      },
    })
    // Same level, node, coverage, and assignment rows: no structure change.
    expect(
      after.levels.map(({ id, label, order }) => ({ id, label, order }))
    ).toEqual(
      before.levels.map(({ id, label, order }) => ({ id, label, order }))
    )
    expect(after.nodes).toEqual(before.nodes)
    expect(after.levelCoverages).toEqual(before.levelCoverages)
    expect(after.elementAssignments).toEqual(before.elementAssignments)

    for (const levelColors of [
      [{ levelId: middle!.id, color: 'blue' }],
      [{ levelId: middle!.id, color: '#12345' }],
    ]) {
      await expect(
        updateCompetenceTreeMetadata(
          {
            id: tree.id,
            input: {
              name: tree.name,
              displayName: tree.displayName,
              levelColors,
            },
          },
          ownerCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' },
      })
    }

    const otherTree = await createCompetenceTree(
      { input: treeInput((await createElement(ownerCtx)).id) },
      ownerCtx
    )
    await expect(
      updateCompetenceTreeMetadata(
        {
          id: tree.id,
          input: {
            name: tree.name,
            displayName: tree.displayName,
            levelColors: [
              { levelId: otherTree.levels[0]!.id, color: '#ff0000' },
            ],
          },
        },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' },
    })
    expect(
      (
        await prisma.competenceTreeLevel.findUniqueOrThrow({
          where: { id: otherTree.levels[0]!.id },
        })
      ).color
    ).toBeNull()

    await expect(
      updateCompetenceTreeMetadata(
        {
          id: tree.id,
          input: {
            name: tree.name,
            displayName: tree.displayName,
            levelColors: [{ levelId: middle!.id, color: '#ff0000' }],
          },
        },
        otherCtx
      )
    ).rejects.toBeTruthy()
  })
})
