import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { ElementInstanceOptions, ElementOptions } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { applyElementBatchOperations } from '../src/services/elements.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Unit tests batch operations on elements', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      emitter: newEmitter,
      hatchet: newHatchet,
    } = await initializePrisma()
    prisma = newPrisma
    emitter = newEmitter
    hatchet = newHatchet
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const { userOneCtx: ctx1, userTwoCtx: ctx2 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = ctx1
    userTwoCtx = ctx2
  })

  afterEach(async () => await testCleanup(prisma))

  async function seedElement(args: { [x: string]: any }, prisma: PrismaClient) {
    // Randomly choose one of the values of ElementType
    const elementTypes = Object.values(ElementType)
    const randomType =
      elementTypes[Math.floor(Math.random() * elementTypes.length)]!

    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: randomType,
        options: {} as ElementOptions,
        ownerId: userOneCtx.user.sub,
        ...args,
      },
    })

    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userOneCtx.user.sub },
      prisma
    )

    return element.id
  }

  async function seedElementPermissions(
    prisma: PrismaClient,
    args: { [x: string]: any } = {}
  ) {
    const readElement = await seedElement(
      {
        ...args,
        ownerId: userTwoCtx.user.sub,
        directPermissions: {
          create: {
            userId: userOneCtx.user.sub,
            permissionLevel: PermissionLevel.READ,
          },
        },
      },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: readElement }, prisma)

    const executeElement = await seedElement(
      {
        ...args,
        ownerId: userTwoCtx.user.sub,
        directPermissions: {
          create: {
            userId: userOneCtx.user.sub,
            permissionLevel: PermissionLevel.EXECUTE,
          },
        },
      },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: executeElement }, prisma)

    const writeElement = await seedElement(
      {
        ...args,
        ownerId: userTwoCtx.user.sub,
        directPermissions: {
          create: {
            userId: userOneCtx.user.sub,
            permissionLevel: PermissionLevel.WRITE,
          },
        },
      },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: writeElement }, prisma)

    const adminElement = await seedElement(
      {
        ...args,
        ownerId: userTwoCtx.user.sub,
        directPermissions: {
          create: {
            userId: userOneCtx.user.sub,
            permissionLevel: PermissionLevel.ADMIN,
          },
        },
      },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: adminElement }, prisma)

    return { readElement, executeElement, writeElement, adminElement }
  }

  async function seedElementsDifferentTypes(prisma: PrismaClient) {
    const SCWithSampleSolution = await seedElement(
      {
        type: ElementType.SC,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const SCWithoutSampleSolution = await seedElement(
      {
        type: ElementType.SC,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const MCWithSampleSolution = await seedElement(
      {
        type: ElementType.MC,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const MCWithoutSampleSolution = await seedElement(
      {
        type: ElementType.MC,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const KPWithSampleSolution = await seedElement(
      {
        type: ElementType.KPRIM,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const KPWithoutSampleSolution = await seedElement(
      {
        type: ElementType.KPRIM,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const NRWithSampleSolution = await seedElement(
      {
        type: ElementType.NUMERICAL,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const NRWithoutSampleSolution = await seedElement(
      {
        type: ElementType.NUMERICAL,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const FTWithSampleSolution = await seedElement(
      {
        type: ElementType.FREE_TEXT,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const FTWithoutSampleSolution = await seedElement(
      {
        type: ElementType.FREE_TEXT,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const SEWithSampleSolution = await seedElement(
      {
        type: ElementType.SELECTION,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const SEWithoutSampleSolution = await seedElement(
      {
        type: ElementType.SELECTION,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const CSWithSampleSolution = await seedElement(
      {
        type: ElementType.CASE_STUDY,
        options: { hasSampleSolution: true },
      },
      prisma
    )
    const CSWithoutSampleSolution = await seedElement(
      {
        type: ElementType.CASE_STUDY,
        options: { hasSampleSolution: false },
      },
      prisma
    )

    const FC = await seedElement(
      {
        type: ElementType.FLASHCARD,
        options: {},
      },
      prisma
    )

    const content = await seedElement(
      {
        type: ElementType.CONTENT,
        options: {},
      },
      prisma
    )

    return {
      SCWithSampleSolution,
      SCWithoutSampleSolution,
      MCWithSampleSolution,
      MCWithoutSampleSolution,
      KPWithSampleSolution,
      KPWithoutSampleSolution,
      NRWithSampleSolution,
      NRWithoutSampleSolution,
      FTWithSampleSolution,
      FTWithoutSampleSolution,
      SEWithSampleSolution,
      SEWithoutSampleSolution,
      CSWithSampleSolution,
      CSWithoutSampleSolution,
      FC,
      content,
    }
  }

  it('Verify that only either the archive or unarchive flags can be set', async () => {
    // verify that if no instances are provided, the operation will return 0
    const res = await applyElementBatchOperations(
      {
        elementIds: [],
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )
    expect(res).toEqual(0)

    // verify that if both archive and unarchive are set, the operation will return 0
    const resBoth = await applyElementBatchOperations(
      {
        elementIds: [1, 2],
        archive: true,
        unarchive: true,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )
    expect(resBoth).toEqual(0)
  })

  it('Verify that only non-archived elements can be archived', async () => {
    const archivedElements = await Promise.all(
      Array.from(
        { length: 5 },
        async () => await seedElement({ isArchived: true }, prisma)
      )
    )
    const nonArchivedElements = await Promise.all(
      Array.from(
        { length: 5 },
        async () => await seedElement({ isArchived: false }, prisma)
      )
    )

    const res = await applyElementBatchOperations(
      {
        elementIds: [...archivedElements, ...nonArchivedElements],
        archive: true,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only non-archived elements were archived
    expect(res).toEqual(nonArchivedElements.length)

    // verify that the archived elements are still archived
    const archivedCheck = await prisma.element.findMany({
      where: {
        id: { in: archivedElements },
        isArchived: true,
      },
    })
    expect(archivedCheck.length).toEqual(archivedElements.length)

    // verify that the non-archived elements are now archived
    const nonArchivedCheck = await prisma.element.findMany({
      where: {
        id: { in: nonArchivedElements },
        isArchived: true,
      },
    })
    expect(nonArchivedCheck.length).toEqual(nonArchivedElements.length)
  })

  it('Verify that only archived elements can be unarchived', async () => {
    const archivedElements = await Promise.all(
      Array.from(
        { length: 5 },
        async () => await seedElement({ isArchived: true }, prisma)
      )
    )
    const nonArchivedElements = await Promise.all(
      Array.from(
        { length: 5 },
        async () => await seedElement({ isArchived: false }, prisma)
      )
    )

    const res = await applyElementBatchOperations(
      {
        elementIds: [...archivedElements, ...nonArchivedElements],
        archive: false,
        unarchive: true,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only archived elements were unarchived
    expect(res).toEqual(archivedElements.length)

    // verify that the non-archived elements are still non-archived
    const nonArchivedCheck = await prisma.element.findMany({
      where: {
        id: { in: nonArchivedElements },
        isArchived: false,
      },
    })
    expect(nonArchivedCheck.length).toEqual(nonArchivedElements.length)

    // verify that the archived elements are now non-archived
    const archivedCheck = await prisma.element.findMany({
      where: {
        id: { in: archivedElements },
        isArchived: false,
      },
    })
    expect(archivedCheck.length).toEqual(archivedElements.length)
  })

  it('Verify that admin permissions are required for elements to be archived / unarchived', async () => {
    const { readElement, executeElement, writeElement, adminElement } =
      await seedElementPermissions(prisma)

    // try to archive all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        archive: true,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only the admin element was archived
    expect(res).toEqual(1)

    // verify that the other elements are still non-archived
    const nonArchivedCheck = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement, writeElement] },
        isArchived: false,
      },
    })
    expect(nonArchivedCheck.length).toEqual(3)

    // verify that the admin element is now archived
    const archivedCheck = await prisma.element.findMany({
      where: {
        id: adminElement,
        isArchived: true,
      },
    })
    expect(archivedCheck.length).toEqual(1)

    // archive all directly through the prisma client
    await prisma.element.updateMany({
      where: {
        id: { in: [readElement, executeElement, writeElement, adminElement] },
      },
      data: { isArchived: true },
    })

    // try to unarchive all elements
    const resUnarchive = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        archive: false,
        unarchive: true,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only the admin element was unarchived
    expect(resUnarchive).toEqual(1)

    // verify that the other elements are still archived
    const archivedCheckAfterUnarchive = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement, writeElement] },
        isArchived: true,
      },
    })
    expect(archivedCheckAfterUnarchive.length).toEqual(3)

    // verify that the admin element is now non-archived
    const nonArchivedCheckAfterUnarchive = await prisma.element.findMany({
      where: {
        id: adminElement,
        isArchived: false,
      },
    })
    expect(nonArchivedCheckAfterUnarchive.length).toEqual(1)
  })

  it('Verify that status changes can be performed by all users that have some level of access to an element', async () => {
    const { readElement, executeElement, writeElement, adminElement } =
      await seedElementPermissions(prisma)

    // try to change the status of all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        archive: false,
        unarchive: false,
        status: ElementStatus.REVIEW,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that all elements were updated
    expect(res).toEqual(4)

    // verify that the status of all elements was changed to REVIEW
    const updatedElements = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement, writeElement, adminElement] },
        status: ElementStatus.REVIEW,
      },
    })
    expect(updatedElements.length).toEqual(4)

    // try to change the status of all elements to DRAFT
    const resDraft = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        archive: false,
        unarchive: false,
        status: ElementStatus.DRAFT,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that all elements were updated
    expect(resDraft).toEqual(4)

    // verify that the status of all elements was changed to DRAFT
    const updatedElementsDraft = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement, writeElement, adminElement] },
        status: ElementStatus.DRAFT,
      },
    })
    expect(updatedElementsDraft.length).toEqual(4)
  })

  it('Allows a course-inherited ADMIN user to update an element in a batch', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.SC,
        options: { hasSampleSolution: true, choices: [] },
        ownerId: userOneCtx.user.sub,
      },
    })
    const now = new Date()
    const course = await prisma.course.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        pinCode: Math.floor(100000 + Math.random() * 900000),
        startDate: now,
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        ownerId: userOneCtx.user.sub,
        directPermissions: {
          create: {
            userId: userTwoCtx.user.sub,
            permissionLevel: PermissionLevel.ADMIN,
            propagation: true,
          },
        },
      },
    })
    await seedLiveQuiz(
      {
        elements: [{ id: element.id, type: element.type }],
        courseId: course.id,
      },
      userOneCtx
    )
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const inheritedPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(inheritedPermission).toMatchObject({
      permissionLevel: PermissionLevel.ADMIN,
      derived: true,
    })

    const result = await applyElementBatchOperations(
      {
        elementIds: [element.id],
        archive: false,
        unarchive: false,
        multiplier: 2,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userTwoCtx
    )

    expect(result).toBe(1)
    await expect(
      prisma.element.findUniqueOrThrow({ where: { id: element.id } })
    ).resolves.toMatchObject({ pointsMultiplier: 2 })
  })

  it('Keeps the changeElementStatus mutation available with READ access', async () => {
    const elementId = await seedElement(
      {
        ownerId: userTwoCtx.user.sub,
        directPermissions: {
          create: {
            userId: userOneCtx.user.sub,
            permissionLevel: PermissionLevel.READ,
          },
        },
      },
      prisma
    )
    await recomputeDerivedPermissions({ elementId }, prisma)

    const resolver = schema.getMutationType()?.getFields()
      .changeElementStatus?.resolve
    expect(resolver).toBeDefined()

    const result = await resolver!(
      {},
      { elementId, status: ElementStatus.REVIEW },
      userOneCtx,
      {} as never
    )

    expect(result).toBe(true)
    await expect(
      prisma.element.findUniqueOrThrow({ where: { id: elementId } })
    ).resolves.toMatchObject({ status: ElementStatus.REVIEW })
  })

  it('Verify that multiplier changes can only be made on elements with a well-defined sample solution', async () => {
    const {
      SCWithSampleSolution,
      SCWithoutSampleSolution,
      MCWithSampleSolution,
      MCWithoutSampleSolution,
      KPWithSampleSolution,
      KPWithoutSampleSolution,
      NRWithSampleSolution,
      NRWithoutSampleSolution,
      FTWithSampleSolution,
      FTWithoutSampleSolution,
      SEWithSampleSolution,
      SEWithoutSampleSolution,
      CSWithSampleSolution,
      CSWithoutSampleSolution,
      FC,
      content,
    } = await seedElementsDifferentTypes(prisma)

    // try to apply multiplier changes on all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [
          SCWithSampleSolution,
          SCWithoutSampleSolution,
          MCWithSampleSolution,
          MCWithoutSampleSolution,
          KPWithSampleSolution,
          KPWithoutSampleSolution,
          NRWithSampleSolution,
          NRWithoutSampleSolution,
          FTWithSampleSolution,
          FTWithoutSampleSolution,
          SEWithSampleSolution,
          SEWithoutSampleSolution,
          CSWithSampleSolution,
          CSWithoutSampleSolution,
          FC,
          content,
        ],
        multiplier: 2,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only elements with a sample solution were updated
    expect(res).toEqual(7)

    // verify that the elements with a sample solution have the multiplier set to 2
    const updatedElements = await prisma.element.findMany({
      where: { pointsMultiplier: 2 },
    })
    expect(updatedElements.length).toEqual(7)

    // verify that the elements are the correct ones
    const updatedElementIds = updatedElements.map((el) => el.id)
    expect(new Set(updatedElementIds)).toEqual(
      new Set([
        SCWithSampleSolution,
        MCWithSampleSolution,
        KPWithSampleSolution,
        NRWithSampleSolution,
        FTWithSampleSolution,
        SEWithSampleSolution,
        CSWithSampleSolution,
      ])
    )
  })

  it('Verify that multiplier changes can be performed by all users that have at least write access to an element', async () => {
    const { readElement, executeElement, writeElement, adminElement } =
      await seedElementPermissions(prisma, {
        type: ElementType.SC,
        options: { hasSampleSolution: true },
      })

    // try to change the multiplier of all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        multiplier: 2,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only the write and admin elements were updated
    expect(res).toEqual(2)

    // verify that the multiplier of the write and admin elements was changed to 2
    const updatedElements = await prisma.element.findMany({
      where: {
        id: { in: [writeElement, adminElement] },
        pointsMultiplier: 2,
      },
    })
    expect(updatedElements.length).toEqual(2)

    // verify that the read and execute elements are still unchanged
    const unchangedElements = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement] },
        pointsMultiplier: 1,
      },
    })
    expect(unchangedElements.length).toEqual(2)
  })

  it('Verify that base points can only be set on questions (not flashcards or content elements)', async () => {
    const {
      SCWithSampleSolution,
      SCWithoutSampleSolution,
      MCWithSampleSolution,
      MCWithoutSampleSolution,
      KPWithSampleSolution,
      KPWithoutSampleSolution,
      NRWithSampleSolution,
      NRWithoutSampleSolution,
      FTWithSampleSolution,
      FTWithoutSampleSolution,
      SEWithSampleSolution,
      SEWithoutSampleSolution,
      CSWithSampleSolution,
      CSWithoutSampleSolution,
      FC,
      content,
    } = await seedElementsDifferentTypes(prisma)

    // try to disable base points on all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [
          SCWithSampleSolution,
          SCWithoutSampleSolution,
          MCWithSampleSolution,
          MCWithoutSampleSolution,
          KPWithSampleSolution,
          KPWithoutSampleSolution,
          NRWithSampleSolution,
          NRWithoutSampleSolution,
          FTWithSampleSolution,
          FTWithoutSampleSolution,
          SEWithSampleSolution,
          SEWithoutSampleSolution,
          CSWithSampleSolution,
          CSWithoutSampleSolution,
          FC,
          content,
        ],
        basePoints: false,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that all elements have base points disabled now (14 / 16 modified)
    expect(res).toEqual(14)

    // verify that all elements in the database now have base points disabled
    const updatedElements = await prisma.element.findMany({
      where: { basePoints: false },
    })
    expect(updatedElements.length).toEqual(14)

    // enable base points on all elements
    const resEnable = await applyElementBatchOperations(
      {
        elementIds: [
          SCWithSampleSolution,
          SCWithoutSampleSolution,
          MCWithSampleSolution,
          MCWithoutSampleSolution,
          KPWithSampleSolution,
          KPWithoutSampleSolution,
          NRWithSampleSolution,
          NRWithoutSampleSolution,
          FTWithSampleSolution,
          FTWithoutSampleSolution,
          SEWithSampleSolution,
          SEWithoutSampleSolution,
          CSWithSampleSolution,
          CSWithoutSampleSolution,
          FC,
          content,
        ],
        basePoints: true,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that all elements have base points enabled now (14 / 16 modified)
    expect(resEnable).toEqual(14)

    // verify that all elements in the database now have base points enabled (default for FC / CT)
    const updatedElementsEnable = await prisma.element.findMany({
      where: { basePoints: true },
    })
    expect(updatedElementsEnable.length).toEqual(16)
  })

  it('Verify that base points can only be set by users that have at least write access to an element', async () => {
    const { readElement, executeElement, writeElement, adminElement } =
      await seedElementPermissions(prisma, {
        type: ElementType.SC,
        basePoints: true,
      })

    // try to unset base points on all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        basePoints: false,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only the write and admin elements were updated
    expect(res).toEqual(2)

    // verify that the base points of the write and admin elements were changed to false
    const updatedElements = await prisma.element.findMany({
      where: {
        id: { in: [writeElement, adminElement] },
        basePoints: false,
      },
    })
    expect(updatedElements.length).toEqual(2)

    // verify that the read and execute elements are still unchanged
    const unchangedElements = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement] },
        basePoints: true,
      },
    })
    expect(unchangedElements.length).toEqual(2)

    // disable the base points on all elements through the prisma client
    await prisma.element.updateMany({
      where: {
        id: { in: [readElement, executeElement, writeElement, adminElement] },
      },
      data: { basePoints: false },
    })

    // try to enable base points on all elements
    const resEnable = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        basePoints: true,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that only the write and admin elements were updated
    expect(resEnable).toEqual(2)

    // verify that the base points of the write and admin elements were changed to true
    const updatedElementsEnable = await prisma.element.findMany({
      where: {
        id: { in: [writeElement, adminElement] },
        basePoints: true,
      },
    })
    expect(updatedElementsEnable.length).toEqual(2)

    // verify that the read and execute elements are still unchanged
    const unchangedElementsEnable = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement] },
        basePoints: false,
      },
    })
    expect(unchangedElementsEnable.length).toEqual(2)
  })

  it('Verify that combinations of the batch operations are applied correctly (e.g. multiplier and base points, multiplier and status, etc.)', async () => {
    const { readElement, executeElement, writeElement, adminElement } =
      await seedElementPermissions(prisma, {
        type: ElementType.SC,
        status: ElementStatus.DRAFT,
        pointsMultiplier: 1,
        options: { hasSampleSolution: true },
      })

    // try to change the status and multiplier of all elements
    const res = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        status: ElementStatus.REVIEW,
        multiplier: 2,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // verify that the changes only went into effect for the write and admin elements
    expect(res).toEqual(2)

    // verify that the status of the write and admin elements was changed to REVIEW
    // and the multiplier was set to 2
    const updatedElements = await prisma.element.findMany({
      where: {
        id: { in: [writeElement, adminElement] },
        status: ElementStatus.REVIEW,
        pointsMultiplier: 2,
      },
    })
    expect(updatedElements.length).toEqual(2)

    // verify that the read and execute elements are still unchanged
    const unchangedElements = await prisma.element.findMany({
      where: {
        id: { in: [readElement, executeElement] },
        status: ElementStatus.DRAFT,
        pointsMultiplier: 1,
      },
    })
    expect(unchangedElements.length).toEqual(2)

    // reset status and points multiplier,
    await prisma.element.updateMany({
      where: {
        id: { in: [readElement, executeElement, writeElement, adminElement] },
      },
      data: { status: ElementStatus.DRAFT, pointsMultiplier: 1 },
    })

    // unset the sample solution on the read and write elements
    await prisma.element.updateMany({
      where: { id: { in: [readElement, writeElement] } },
      data: { options: { hasSampleSolution: false } },
    })

    // try to change the multiplier and the base points of all elements
    const resMultiplierBasePoints = await applyElementBatchOperations(
      {
        elementIds: [readElement, executeElement, writeElement, adminElement],
        multiplier: 2,
        basePoints: false,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )

    // make sure that higher requiremenet of sample solution and write access was deciding -> only admin element was updated
    expect(resMultiplierBasePoints).toEqual(1)

    // verify that the multiplier of the admin element was changed to 2 and base points were disabled
    const updatedElementsMultiplierBasePoints = await prisma.element.findMany({
      where: {
        id: adminElement,
        pointsMultiplier: 2,
        basePoints: false,
      },
    })
    expect(updatedElementsMultiplierBasePoints.length).toEqual(1)

    // verify that the read, execute and write elements are still unchanged
    const unchangedElementsMultiplierBasePoints = await prisma.element.findMany(
      {
        where: {
          id: { in: [readElement, executeElement, writeElement] },
          pointsMultiplier: 1,
          basePoints: true,
        },
      }
    )
    expect(unchangedElementsMultiplierBasePoints.length).toEqual(3)
  })

  it('Verify that element instance updates are correctly executed when corresponding flag is set', async () => {
    const SCUpdated = await prisma.element.create({
      data: {
        name: 'Sample SC',
        content: 'Sample content',
        type: ElementType.SC,
        options: { hasSampleSolution: true, choices: [] },
        ownerId: userOneCtx.user.sub,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SCUpdated.id, userId: userOneCtx.user.sub },
      prisma
    )
    expect(SCUpdated).not.toBeNull()

    const SCNotUpdated = await prisma.element.create({
      data: {
        name: 'Sample SC',
        content: 'Sample content',
        type: ElementType.SC,
        options: { hasSampleSolution: false, choices: [] },
        ownerId: userOneCtx.user.sub,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SCNotUpdated.id, userId: userOneCtx.user.sub },
      prisma
    )
    expect(SCNotUpdated).not.toBeNull()

    // include both elements in a live quiz
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        ownerId: userOneCtx.user.sub,
        pointsMultiplier: 2,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: SCUpdated.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: { pointsMultiplier: 2 } as ElementInstanceOptions,
                    elementData: processElementData(SCUpdated),
                    results: getInitialInstanceResults(
                      processElementData(SCUpdated)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(SCUpdated)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: SCNotUpdated.id,
                    elementType: ElementType.SC,
                    order: 1,
                    options: { pointsMultiplier: 1 } as ElementInstanceOptions,
                    elementData: processElementData(SCNotUpdated),
                    results: getInitialInstanceResults(
                      processElementData(SCNotUpdated)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(SCNotUpdated)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userOneCtx.user.sub },
      prisma
    )
    expect(liveQuiz).not.toBeNull()

    // trigger an update of the mulitplier with the instance update flag disabled
    const res = await applyElementBatchOperations(
      {
        elementIds: [SCUpdated.id, SCNotUpdated.id],
        multiplier: 2,
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      },
      userOneCtx
    )
    expect(res).toEqual(1)

    // verify that only the multiplier of the SCUpdated element was changed
    const updatedElements = await prisma.element.findMany({
      where: {
        id: SCUpdated.id,
        pointsMultiplier: 2,
      },
    })
    expect(updatedElements.length).toEqual(1)

    // verify that the multiplier of the SCNotUpdated element is still 1
    const unchangedElements = await prisma.element.findMany({
      where: {
        id: SCNotUpdated.id,
        pointsMultiplier: 1,
      },
    })
    expect(unchangedElements.length).toEqual(1)

    // verify that the instance of the SCUpdated element was not updated
    const updatedInstance = await prisma.elementInstance.findFirst({
      where: {
        elementId: SCUpdated.id,
        type: ElementInstanceType.LIVE_QUIZ,
      },
    })
    expect(updatedInstance?.elementData.id).toEqual(`${SCUpdated.id}-v1`)
    expect(updatedInstance?.elementData.pointsMultiplier).toEqual(1)
    expect(updatedInstance?.options.pointsMultiplier).toEqual(2)

    // change the muliplier to 3 with the instance update flag enabled
    const resWithUpdate = await applyElementBatchOperations(
      {
        elementIds: [SCUpdated.id, SCNotUpdated.id],
        multiplier: 3,
        archive: false,
        unarchive: false,
        updateInstances: true,
        updateTemplateInstances: false,
      },
      userOneCtx
    )
    expect(resWithUpdate).toEqual(1)

    // verify that the multiplier of the SCUpdated element was changed to 3
    const updatedElementsWithUpdate = await prisma.element.findMany({
      where: {
        id: { in: [SCUpdated.id] },
        pointsMultiplier: 3,
      },
    })
    expect(updatedElementsWithUpdate.length).toEqual(1)

    // verify that the multiplier of the SCNotUpdated element is still 1
    const unchangedElementsWithUpdate = await prisma.element.findMany({
      where: {
        id: { in: [SCNotUpdated.id] },
        pointsMultiplier: 1,
      },
    })
    expect(unchangedElementsWithUpdate.length).toEqual(1)

    // verify that the instance of the SCUpdated element was updated
    const updatedInstanceWithUpdate = await prisma.elementInstance.findFirst({
      where: {
        elementId: SCUpdated.id,
        type: ElementInstanceType.LIVE_QUIZ,
      },
    })
    expect(updatedInstanceWithUpdate?.elementData.id).toEqual(
      `${SCUpdated.id}-v3`
    )
    expect(updatedInstanceWithUpdate?.elementData.pointsMultiplier).toEqual(3)
    expect(updatedInstanceWithUpdate?.options.pointsMultiplier).toEqual(6)
  })
})
