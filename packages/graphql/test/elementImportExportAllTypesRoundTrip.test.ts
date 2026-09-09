import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { ElementStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createElementExportPackage,
  importElementPackageBuffer,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import {
  createNineTypeImportPackage,
  normalizedPackageJson,
  packageGradingScores,
} from './fixtures/importExportNineTypes.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('all-type import/export equivalence', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
  let userTwoCtx: Awaited<ReturnType<typeof testInitialization>>['userTwoCtx']

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  it('preserves normalized didactics and grading across all nine real types', async () => {
    const fixture = createNineTypeImportPackage()
    expect(
      validateElementImportPackageBuffer(fixture.buffer).preview.elements
    ).toHaveLength(9)

    await expect(
      importElementPackageBuffer(
        {
          buffer: fixture.buffer,
          selectedElementRefs: fixture.elementRefs,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      importedElements: 9,
      importedAnswerCollections: 1,
      skippedElements: 0,
    })

    const firstImported = await prisma.element.findMany({
      where: {
        ownerId: userOneCtx.user.sub,
        originalId: { startsWith: 'import-package:' },
      },
      include: { permissions: true, tags: true },
      orderBy: { id: 'asc' },
    })
    expect(firstImported).toHaveLength(9)
    expect(
      firstImported.every((element) => element.status === ElementStatus.REVIEW)
    ).toBe(true)
    expect(firstImported.every((element) => element.tags.length === 0)).toBe(
      true
    )
    expect(
      firstImported.every(
        (element) =>
          element.permissions.length === 1 &&
          element.permissions[0]?.userId === userOneCtx.user.sub
      )
    ).toBe(true)

    const firstExport = await createElementExportPackage(
      { elementIds: firstImported.map((element) => element.id) },
      userOneCtx
    )
    const firstPreview = validateElementImportPackageBuffer(firstExport.buffer)
    expect(firstPreview.preview.elements).toHaveLength(9)
    expect(firstPreview.preview.answerCollections).toHaveLength(1)

    await expect(
      importElementPackageBuffer(
        {
          buffer: firstExport.buffer,
          selectedElementRefs: firstPreview.preview.elements.map(
            (element) => element.ref
          ),
        },
        userTwoCtx
      )
    ).resolves.toEqual({
      importedElements: 9,
      importedAnswerCollections: 1,
      skippedElements: 0,
    })

    const secondImported = await prisma.element.findMany({
      where: {
        ownerId: userTwoCtx.user.sub,
        originalId: { startsWith: 'import-package:' },
      },
      include: { tags: true },
      orderBy: { id: 'asc' },
    })
    expect(secondImported).toHaveLength(9)
    expect(secondImported.every((element) => element.tags.length === 0)).toBe(
      true
    )

    const secondExport = await createElementExportPackage(
      { elementIds: secondImported.map((element) => element.id) },
      userTwoCtx
    )

    expect(normalizedPackageJson(secondExport.buffer)).toEqual(
      normalizedPackageJson(firstExport.buffer)
    )
    const firstScores = packageGradingScores(firstExport.buffer)
    const secondScores = packageGradingScores(secondExport.buffer)
    expect(secondScores).toEqual(firstScores)
    expect(Object.values(firstScores)).toEqual(Array(7).fill(1))

    for (const buffer of [firstExport.buffer, secondExport.buffer]) {
      const serialized = JSON.stringify(normalizedPackageJson(buffer))
      expect(serialized).toContain('Δx ≈ 0,00\u202fµm 🧪')
      expect(serialized).not.toContain('"tags"')
      expect(serialized).not.toContain('"ownerId"')
      expect(serialized).not.toContain('"permissions"')
      expect(serialized).not.toContain('"participantResponses"')
      expect(serialized).not.toContain('"psychometric"')
      expect(serialized).not.toContain('"source"')
    }
  })
})
