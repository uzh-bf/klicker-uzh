import {
  ElementInstanceType,
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import { ActivityType } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  MISSING_CATALOG_COLLECTION_ID,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { updateElementInstances } from '../src/services/elements.js'
import {
  getAnswerCollectionsElements,
  getAnswerCollectionsInfo,
} from '../src/services/resources.js'
import {
  createActivityTemplate,
  deleteActivityTemplate,
  getMatchingUserElementsTemplate,
  validateTemplateAccessible,
} from '../src/services/templates.js'
import {
  initializePrisma,
  seedCatalogCollections,
  seedLiveQuizTemplates,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { questionsSLAF } from './testData.js'
import { userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests for template service', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

  beforeAll(async () => {
    const { prisma: newPrisma, emitter: newEmitter } = await initializePrisma()
    prisma = newPrisma
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const {
      userOneCtx: ctx1,
      userTwoCtx: ctx2,
      userThreeCtx: ctx3,
      userFourCtx: ctx4,
      userFiveCtx: ctx5,
    } = await testInitialization(prisma, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  it('Verify that matching questions are correctly filtered when loaded from the database', async () => {
    // seed a number of minimal elements into the database
    await Promise.all(
      questionsSLAF.map(async (question) => {
        const newElement = await prisma.element.create({
          data: {
            name: question.name,
            content: '',
            type: question.type,
            options: question.options,
            owner: {
              connect: { id: userOne.id },
            },
          },
        })

        await recomputeDerivedPermissions(
          {
            elementId: newElement.id,
            userId: userOne.id,
          },
          prisma
        )

        return newElement
      })
    )

    // test the different combinations of queries that can be made from a template activity
    const res1 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res1).toHaveLength(1)
    expect(res1[0]).toBeTruthy()
    expect(res1[0]!.name).toBe('SC NO SL NO AF')

    const res2 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res2).toHaveLength(1)
    expect(res2[0]).toBeTruthy()
    expect(res2[0]!.name).toBe('SC WITH SL NO AF')

    const res3 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res3).toHaveLength(1)
    expect(res3[0]).toBeTruthy()
    expect(res3[0]!.name).toBe('SC WITH SL WITH AF')

    const res4 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res4).toHaveLength(0) // combination should not exist

    const res5 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.MC,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res5).toHaveLength(1)
    expect(res5[0]).toBeTruthy()
    expect(res5[0]!.name).toBe('MC NO SL NO AF')

    const res6 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.MC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res6).toHaveLength(1)
    expect(res6[0]).toBeTruthy()
    expect(res6[0]!.name).toBe('MC WITH SL NO AF')

    const res7 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.MC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res7).toHaveLength(1)
    expect(res7[0]).toBeTruthy()
    expect(res7[0]!.name).toBe('MC WITH SL WITH AF')

    const res8 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.MC,
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res8).toHaveLength(0) // combination should not exist

    const res9 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.KPRIM,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res9).toHaveLength(1)
    expect(res9[0]).toBeTruthy()
    expect(res9[0]!.name).toBe('KPRIM NO SL NO AF')

    const res10 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.KPRIM,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res10).toHaveLength(1)
    expect(res10[0]).toBeTruthy()
    expect(res10[0]!.name).toBe('KPRIM WITH SL NO AF')

    const res11 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.KPRIM,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res11).toHaveLength(1)
    expect(res11[0]).toBeTruthy()
    expect(res11[0]!.name).toBe('KPRIM WITH SL WITH AF')

    const res12 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.KPRIM,
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res12).toHaveLength(0) // combination should not exist

    const res13 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.NUMERICAL,
        hasSampleSolution: false,
      },
      userOneCtx
    )
    expect(res13).toHaveLength(1)
    expect(res13[0]).toBeTruthy()
    expect(res13[0]!.name).toBe('NUMERICAL NO SL')

    const res14 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.NUMERICAL,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res14).toHaveLength(1)
    expect(res14[0]).toBeTruthy()
    expect(res14[0]!.name).toBe('NUMERICAL WITH SL')

    const res15 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FREE_TEXT,
        hasSampleSolution: false,
      },
      userOneCtx
    )
    expect(res15).toHaveLength(1)
    expect(res15[0]).toBeTruthy()
    expect(res15[0]!.name).toBe('FREE_TEXT NO SL')

    const res16 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FREE_TEXT,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res16).toHaveLength(1)
    expect(res16[0]).toBeTruthy()
    expect(res16[0]!.name).toBe('FREE_TEXT WITH SL')

    const res17 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SELECTION,
        hasSampleSolution: false,
      },
      userOneCtx
    )
    expect(res17).toHaveLength(1)
    expect(res17[0]).toBeTruthy()
    expect(res17[0]!.name).toBe('SELECTION NO SL')

    const res18 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SELECTION,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res18).toHaveLength(1)
    expect(res18[0]).toBeTruthy()
    expect(res18[0]!.name).toBe('SELECTION WITH SL')

    const res19 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.CASE_STUDY,
        hasSampleSolution: false,
      },
      userOneCtx
    )
    expect(res19).toHaveLength(1)
    expect(res19[0]).toBeTruthy()
    expect(res19[0]!.name).toBe('CASE_STUDY NO SL')

    const res20 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.CASE_STUDY,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res20).toHaveLength(1)
    expect(res20[0]).toBeTruthy()
    expect(res20[0]!.name).toBe('CASE_STUDY WITH SL')

    // answer feedback attribute should not affect questions that do not support it
    const res21 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.NUMERICAL,
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res21).toHaveLength(1)
    expect(res21[0]).toBeTruthy()
    expect(res21[0]!.name).toBe('NUMERICAL NO SL')

    const res22 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FREE_TEXT,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res22).toHaveLength(1)
    expect(res22[0]).toBeTruthy()
    expect(res22[0]!.name).toBe('FREE_TEXT WITH SL')

    const res23 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SELECTION,
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res23).toHaveLength(1)
    expect(res23[0]).toBeTruthy()
    expect(res23[0]!.name).toBe('SELECTION NO SL')

    const res24 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.CASE_STUDY,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      },
      userOneCtx
    )
    expect(res24).toHaveLength(1)
    expect(res24[0]).toBeTruthy()
    expect(res24[0]!.name).toBe('CASE_STUDY WITH SL')

    // not passing certain filters returns all matches
    const res25 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
      },
      userOneCtx
    )
    expect(res25).toHaveLength(3)
    const names25 = res25.map((res) => res.name)
    expect(names25).toEqual(
      expect.arrayContaining([
        'SC NO SL NO AF',
        'SC WITH SL NO AF',
        'SC WITH SL WITH AF',
      ])
    )

    const res26 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res26).toHaveLength(2)
    const names26 = res26.map((res) => res.name)
    expect(names26).toEqual(
      expect.arrayContaining(['SC WITH SL NO AF', 'SC WITH SL WITH AF'])
    )

    const res27 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res27).toHaveLength(1)
    expect(res27[0]).toBeTruthy()
    expect(res27[0]!.name).toBe('SC WITH SL WITH AF')

    const res28 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.NUMERICAL,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res28).toHaveLength(2)
    const names28 = res28.map((res) => res.name)
    expect(names28).toEqual(
      expect.arrayContaining(['NUMERICAL NO SL', 'NUMERICAL WITH SL'])
    )

    // sample solution and answer feedback attributes should not support elements that do not support it
    const res29 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FLASHCARD,
      },
      userOneCtx
    )
    expect(res29).toHaveLength(1)
    expect(res29[0]).toBeTruthy()
    expect(res29[0]!.name).toBe('FLASHCARD')

    const res30 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FLASHCARD,
        hasSampleSolution: true,
      },
      userOneCtx
    )
    expect(res30).toHaveLength(1)
    expect(res30[0]).toBeTruthy()
    expect(res30[0]!.name).toBe('FLASHCARD')

    const res31 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FLASHCARD,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res31).toHaveLength(1)
    expect(res31[0]).toBeTruthy()
    expect(res31[0]!.name).toBe('FLASHCARD')

    const res32 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FLASHCARD,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      userOneCtx
    )
    expect(res32).toHaveLength(1)
    expect(res32[0]).toBeTruthy()
    expect(res32[0]!.name).toBe('FLASHCARD')

    const res33 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.CONTENT,
      },
      userOneCtx
    )
    expect(res33).toHaveLength(1)
    expect(res33[0]).toBeTruthy()
    expect(res33[0]!.name).toBe('CONTENT')

    // verify that queries for other user return nothing (no shared elements)
    const res34 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.SC,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
      },
      userTwoCtx
    )
    expect(res34).toHaveLength(0)

    const res35 = await getMatchingUserElementsTemplate(
      {
        elementType: ElementType.FLASHCARD,
      },
      userTwoCtx
    )
    expect(res35).toHaveLength(0)
  })

  it('Verify access to correct answer collections when using activity template', async () => {
    const templateId = 'e920481c-c6d0-44ea-9486-5a068633d30d'
    const activityId = '6e795dd4-dc50-4fc6-a4c8-847255e443f6'

    // create unshared answer collection for user 1 (used in activity template)
    const AC1 = await prisma.answerCollection.create({
      data: {
        name: 'AC1',
        description: '',
        owner: { connect: { id: userOne.id } },
        accessRequests: {
          create: {
            permissionLevel: PermissionLevel.READ,
            user: { connect: { id: userTwo.id } },
            objectAdminOrOwner: { connect: { id: userOne.id } },
          },
        },
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: AC1.id, userId: userOne.id },
      prisma
    )

    // create unshared answer collection for user 1 (not used in activity template)
    const AC2 = await prisma.answerCollection.create({
      data: {
        name: 'AC2',
        description: '',
        owner: { connect: { id: userOne.id } },
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: AC2.id, userId: userOne.id },
      prisma
    )

    // create answer collection for user 1 (shared with user 2, used in activity template)
    const AC3 = await prisma.answerCollection.create({
      data: {
        name: 'AC3',
        description: '',
        owner: { connect: { id: userOne.id } },
        directPermissions: {
          create: {
            permissionLevel: PermissionLevel.READ,
            user: { connect: { id: userTwo.id } },
          },
        },
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC3.id }, prisma)

    // create answer collection for user 1 (shared with user 2, not used in activity template)
    const AC4 = await prisma.answerCollection.create({
      data: {
        name: '',
        description: '',
        owner: { connect: { id: userOne.id } },
        directPermissions: {
          create: {
            permissionLevel: PermissionLevel.WRITE,
            user: { connect: { id: userTwo.id } },
          },
        },
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC4.id }, prisma)

    // create unshared answer collection for user 2
    const AC5 = await prisma.answerCollection.create({
      data: {
        name: '',
        description: '',
        owner: { connect: { id: userTwo.id } },
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: AC5.id, userId: userTwo.id },
      prisma
    )

    // verify access to answer collections (user 1: 1-4, user 2: 3-5)
    const collectionsUser1 = await getAnswerCollectionsInfo(userOneCtx)
    expect(collectionsUser1).toHaveLength(4)
    const collectionIdsUser1 = collectionsUser1.map(
      (collection) => collection.id
    )
    expect(collectionIdsUser1).toEqual(
      expect.arrayContaining([AC1.id, AC2.id, AC3.id, AC4.id])
    )

    const collectionsUser2 = await getAnswerCollectionsInfo(userTwoCtx)
    expect(collectionsUser2).toHaveLength(3)
    const collectionIdsUser2 = collectionsUser2.map(
      (collection) => collection.id
    )
    expect(collectionIdsUser2).toEqual(
      expect.arrayContaining([AC3.id, AC4.id, AC5.id])
    )

    // create activity template with answer collection (user 1)
    await prisma.activityTemplate.create({
      data: {
        id: templateId,
        description: '',
        instructions: '',
        liveQuiz: {
          create: {
            id: activityId,
            name: '',
            displayName: '',
            owner: { connect: { id: userOne.id } },
          },
        },
        answerCollections: {
          connect: [{ id: AC1.id }, { id: AC3.id }],
        },
      },
    })
    await recomputeDerivedPermissions(
      {
        liveQuizId: activityId,
        userId: userOne.id,
      },
      prisma
    )

    // add template to the top-level catalog collection (accessible to everyone)
    await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: activityId,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: { connect: { id: activityId } },
        catalogCollection: { connect: { id: MISSING_CATALOG_COLLECTION_ID } },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // queries not related to the template should still only return owned or shared answer collections
    const collectionsUser1Alt = await getAnswerCollectionsElements(
      { templateId: undefined },
      userOneCtx
    )
    expect(collectionsUser1Alt).toHaveLength(4)
    const collectionIdsUser1Alt = collectionsUser1Alt.map(
      (collection) => collection.id
    )
    expect(collectionIdsUser1Alt).toEqual(
      expect.arrayContaining([AC1.id, AC2.id, AC3.id, AC4.id])
    )

    const collectionsUser2Alt = await getAnswerCollectionsElements(
      { templateId: undefined },
      userTwoCtx
    )
    expect(collectionsUser2Alt).toHaveLength(3)
    const collectionIdsUser2Alt = collectionsUser2Alt.map(
      (collection) => collection.id
    )
    expect(collectionIdsUser2Alt).toEqual(
      expect.arrayContaining([AC3.id, AC4.id, AC5.id])
    )

    // verify access to answer collections in template (user 1: 1-4, user 2: 1, 3-5)
    const templateCollectionsUser1 = await getAnswerCollectionsElements(
      { templateId },
      userOneCtx
    )
    expect(templateCollectionsUser1).toHaveLength(4)
    const templateCollectionIdsUser1 = templateCollectionsUser1.map(
      (collection) => collection.id
    )
    expect(templateCollectionIdsUser1).toEqual(
      expect.arrayContaining([AC1.id, AC2.id, AC3.id, AC4.id])
    )

    const templateCollectionsUser2 = await getAnswerCollectionsElements(
      { templateId },
      userTwoCtx
    )
    expect(templateCollectionsUser2).toHaveLength(4)
    const templateCollectionIdsUser2 = templateCollectionsUser2.map(
      (collection) => collection.id
    )
    expect(templateCollectionIdsUser2).toEqual(
      expect.arrayContaining([AC1.id, AC3.id, AC4.id, AC5.id])
    )
  })

  it('Verify that when updating element instances in templates, answer collection - template links are updated correctly', async () => {
    // seed three answer collections, one selection question (1) and one case study question (2)
    const AC1 = await prisma.answerCollection.create({
      data: {
        name: 'AC1',
        description: '',
        owner: { connect: { id: userOneCtx.user.sub } },
        entries: {
          create: [
            { value: 'AC1 Entry 1' },
            { value: 'AC1 Entry 2' },
            { value: 'AC1 Entry 3' },
          ],
        },
      },
      include: {
        entries: true,
      },
    })
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC1.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    const AC2 = await prisma.answerCollection.create({
      data: {
        name: 'AC2',
        description: '',
        owner: { connect: { id: userOneCtx.user.sub } },
        entries: {
          create: [
            { value: 'AC2 Entry 1' },
            { value: 'AC2 Entry 2' },
            { value: 'AC2 Entry 3' },
          ],
        },
      },
      include: {
        entries: true,
      },
    })
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC2.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    const AC3 = await prisma.answerCollection.create({
      data: {
        name: 'AC3',
        description: '',
        owner: { connect: { id: userOneCtx.user.sub } },
        entries: {
          create: [
            { value: 'AC3 Entry 1' },
            { value: 'AC3 Entry 2' },
            { value: 'AC3 Entry 3' },
          ],
        },
      },
      include: {
        entries: true,
      },
    })
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC3.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    const SEQuestion = await prisma.element.create({
      data: {
        name: 'Selection Question',
        content: '',
        type: ElementType.SELECTION,
        options: {
          criteria: [],
          cases: [],
          hasSampleSolution: false,
          numberOfInputs: 2,
        },
        answerCollection: { connect: { id: AC1.id } },
        owner: { connect: { id: userOneCtx.user.sub } },
      },
      include: {
        answerCollectionItems: true,
        answerCollection: {
          include: {
            entries: true,
          },
        },
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: SEQuestion.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    const CSQuestion = await prisma.element.create({
      data: {
        name: 'Case Study Question',
        content: '',
        type: ElementType.CASE_STUDY,
        options: {
          criteria: [],
          cases: [],
          items: [],
          hasSampleSolution: false,
        },
        answerCollection: { connect: { id: AC2.id } },
        answerCollectionItems: {
          connect: [{ id: AC2.entries[0]!.id }, { id: AC2.entries[1]!.id }],
        },
        owner: { connect: { id: userOneCtx.user.sub } },
      },
      include: {
        answerCollectionItems: true,
        answerCollection: {
          include: {
            entries: true,
          },
        },
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: CSQuestion.id,
        userId: userOneCtx.user.sub,
      },
      prisma
    )

    // combine these questions into a live quiz and create a template
    const activityId = 'a7b750a4-5fd9-4575-85f1-9f981206477f'
    const SEElementData = processElementData(SEQuestion)
    const CSElementData = processElementData(CSQuestion)
    await prisma.liveQuiz.create({
      data: {
        id: activityId,
        name: 'Test Quiz',
        displayName: 'Test Quiz',
        status: PublicationStatus.TEMPLATE,
        owner: { connect: { id: userOneCtx.user.sub } },
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementData: SEElementData,
                    elementType: ElementType.SELECTION,
                    order: 0,
                    options: {
                      basePoints: false,
                      pointsMultiplier: 0,
                      resetTimeDays: 0,
                    },
                    results: getInitialInstanceResults(SEElementData),
                    anonymousResults: getInitialInstanceResults(SEElementData),
                    elementId: SEQuestion.id,
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
            {
              order: 1,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementData: CSElementData,
                    elementType: ElementType.CASE_STUDY,
                    order: 0,
                    options: {
                      basePoints: false,
                      pointsMultiplier: 0,
                      resetTimeDays: 0,
                    },
                    results: getInitialInstanceResults(CSElementData),
                    anonymousResults: getInitialInstanceResults(CSElementData),
                    elementId: CSQuestion.id,
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
      { liveQuizId: activityId, userId: userOneCtx.user.sub },
      prisma
    )

    await createActivityTemplate(
      {
        activityId,
        activityType: ActivityType.LIVE_QUIZ,
        templateName: 'Template',
        templateDescription: '',
        templateInstructions: '',
        copyBeforeConversion: false,
      },
      userOneCtx
    )

    // verify that answer collections 1 and 2 are linked to the template
    const template = await prisma.activityTemplate.findUnique({
      where: {
        liveQuizId: activityId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const templateId = template?.id
    const answerCollectionIds = template?.answerCollections.map(
      (collection) => collection.id
    )
    expect(templateId).toBeTruthy()
    expect(answerCollectionIds).toHaveLength(2)
    expect(answerCollectionIds).toEqual(
      expect.arrayContaining([AC1.id, AC2.id])
    )
    const answerCollectionItems = template?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionItems).toHaveLength(2)
    expect(answerCollectionItems).toEqual(
      expect.arrayContaining([AC2.entries[0]!.id, AC2.entries[1]!.id])
    )
    expect(template?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion.name
    )
    expect(template?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion.name
    )

    // use the database function to update the selection question without modifying the answer collection
    const SEQuestion2 = await prisma.element.update({
      where: { id: SEQuestion.id },
      data: {
        name: 'Updated Selection Question',
      },
    })
    await updateElementInstances(
      { elementId: SEQuestion.id, includeTemplates: false },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )
    const template2 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    expect(template2?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion.name
    )
    expect(template2?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion.name
    )

    // trigger another element instance update, this time including the activity templates
    await updateElementInstances(
      { elementId: SEQuestion.id, includeTemplates: true },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )

    // verify that the content of the corresponding element instance has changed, the answer collections linked to the template not
    const template3 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const answerCollectionIds3 = template3?.answerCollections.map(
      (collection) => collection.id
    )
    expect(answerCollectionIds3).toHaveLength(2)
    expect(answerCollectionIds3).toEqual(
      expect.arrayContaining([AC1.id, AC2.id])
    )
    const answerCollectionItems3 = template3?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionItems3).toHaveLength(2)
    expect(answerCollectionItems3).toEqual(
      expect.arrayContaining([AC2.entries[0]!.id, AC2.entries[1]!.id])
    )
    expect(template3?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion2.name
    )
    expect(template3?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion.name
    )

    // use the database function to update the selection question with modification of the answer collection (1 -> 3)
    const SEQuestion3 = await prisma.element.update({
      where: { id: SEQuestion.id },
      data: {
        name: 'Updated Selection Question 3',
        answerCollection: {
          connect: { id: AC3.id },
        },
      },
    })
    await updateElementInstances(
      { elementId: SEQuestion.id, includeTemplates: true },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )

    // verify that the instance was correctly updated and that answer collections 2 and 3 are now linked to the template
    const template4 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const answerCollectionIds4 = template4?.answerCollections.map(
      (collection) => collection.id
    )
    expect(answerCollectionIds4).toHaveLength(2)
    expect(answerCollectionIds4).toEqual(
      expect.arrayContaining([AC2.id, AC3.id])
    )
    const answerCollectionItems4 = template4?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionItems4).toHaveLength(2)
    expect(answerCollectionItems4).toEqual(
      expect.arrayContaining([AC2.entries[0]!.id, AC2.entries[1]!.id])
    )
    expect(template4?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion3.name
    )
    expect(template4?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion.name
    )

    // use the database function to update the case study question with modification of the answer collection (2 -> 3)
    const CSQuestion2 = await prisma.element.update({
      where: { id: CSQuestion.id },
      data: {
        name: 'Updated Case Study Question',
        answerCollection: {
          connect: { id: AC3.id },
        },
        answerCollectionItems: {
          disconnect: [{ id: AC2.entries[0]!.id }, { id: AC2.entries[1]!.id }],
          connect: [{ id: AC3.entries[0]!.id }, { id: AC3.entries[1]!.id }],
        },
      },
    })
    await updateElementInstances(
      { elementId: CSQuestion.id, includeTemplates: true },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )

    // verify that the instance was correctly updated and that only answer collection 3 is now linked to the template
    const template5 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const answerCollectionIds5 = template5?.answerCollections.map(
      (collection) => collection.id
    )
    expect(answerCollectionIds5).toHaveLength(1)
    expect(answerCollectionIds5).toEqual(expect.arrayContaining([AC3.id]))
    const answerCollectionItems5 = template5?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionItems5).toHaveLength(2)
    expect(answerCollectionItems5).toEqual(
      expect.arrayContaining([AC3.entries[0]!.id, AC3.entries[1]!.id])
    )
    expect(template5?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion3.name
    )
    expect(template5?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion2.name
    )

    // use the database function to update the case study question with modification of the answer collection (3 -> 1)
    const CSQuestion3 = await prisma.element.update({
      where: { id: CSQuestion.id },
      data: {
        name: 'Updated Case Study Question 3',
        answerCollection: {
          connect: { id: AC1.id },
        },
        answerCollectionItems: {
          disconnect: [{ id: AC3.entries[0]!.id }, { id: AC3.entries[1]!.id }],
          connect: [{ id: AC1.entries[0]!.id }, { id: AC1.entries[1]!.id }],
        },
      },
    })
    await updateElementInstances(
      { elementId: CSQuestion.id, includeTemplates: true },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )

    // verify that the instance was correctly updated and that answer collections 1 and 3 is now linked to the template
    const template6 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const answerCollectionIds6 = template6?.answerCollections.map(
      (collection) => collection.id
    )
    expect(answerCollectionIds6).toHaveLength(2)
    expect(answerCollectionIds6).toEqual(
      expect.arrayContaining([AC1.id, AC3.id])
    )
    const answerCollectionItems6 = template6?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionItems6).toHaveLength(2)
    expect(answerCollectionItems6).toEqual(
      expect.arrayContaining([AC1.entries[0]!.id, AC1.entries[1]!.id])
    )
    expect(template6?.liveQuiz?.blocks[0]?.elements[0]?.elementData.name).toBe(
      SEQuestion3.name
    )
    expect(template6?.liveQuiz?.blocks[1]?.elements[0]?.elementData.name).toBe(
      CSQuestion3.name
    )

    // modify the answer collection entries used in the case study question (same answer collection, but options 2 & 3 instead of 1 & 2)
    await prisma.element.update({
      where: { id: CSQuestion.id },
      data: {
        name: 'Updated Case Study Question 4',
        answerCollectionItems: {
          disconnect: [{ id: AC1.entries[0]!.id }],
          connect: [{ id: AC1.entries[2]!.id }],
        },
      },
    })
    await updateElementInstances(
      { elementId: CSQuestion.id, includeTemplates: true },
      userOneCtx.prisma,
      userOneCtx.emitter,
      userOneCtx.user.sub
    )

    // verify that the update was successful and that the corresponding answer collection entries are now linked to the template
    const template7 = await prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: true,
        answerCollectionItems: true,
        liveQuiz: {
          include: {
            blocks: {
              include: {
                elements: true,
              },
            },
          },
        },
      },
    })
    const answerCollectionIds7 = template7?.answerCollections.map(
      (collection) => collection.id
    )
    const answerCollectionItems7 = template7?.answerCollectionItems.map(
      (item) => item.id
    )
    expect(answerCollectionIds7).toHaveLength(2)
    expect(answerCollectionIds7).toEqual(
      expect.arrayContaining([AC1.id, AC3.id])
    )
    expect(answerCollectionItems7).toHaveLength(2)
    expect(answerCollectionItems7).toEqual(
      expect.arrayContaining([AC1.entries[1]!.id, AC1.entries[2]!.id])
    )

    // delete the live quiz / template, answer collections and questions
    await prisma.liveQuiz.delete({ where: { id: activityId } })
    await prisma.answerCollection.deleteMany({
      where: { id: { in: [AC1.id, AC2.id, AC3.id] } },
    })
    await prisma.element.deleteMany({
      where: { id: { in: [SEQuestion.id, CSQuestion.id] } },
    })
  })

  it('Validate that access to activity templates is correctly checked', async () => {
    // create activity templates for testing
    const {
      activityId1,
      activityId2,
      activityId3,
      templateId1,
      templateId2,
      templateId3,
    } = await seedLiveQuizTemplates(prisma)

    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // seed permissions on the catalog collection for access validation
    // create permissions for users 2, 3, and 4 (READ, WRITE, ADMIN in ascending order)
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.READ,
          userId: userTwo.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.READ,
          userId: userTwo.id,
          catalogCollectionId: restrictedCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: restrictedCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: restrictedCatalog.id,
        },
      ],
    })

    // recompute derived permissions that are checked in backend service functions
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // verify that the creation was successful
    const templates = await prisma.liveQuiz.findMany({
      where: {
        status: PublicationStatus.TEMPLATE,
      },
    })
    expect(templates.length).toBe(3)
    expect(templates.map((template) => template.id)).toEqual(
      expect.arrayContaining([activityId1, activityId2, activityId3])
    )

    // add LQ1 to top level catlaog collection with public access -> should be accessible to everyone
    await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: activityId1,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: activityId1,
          },
        },
        catalogCollection: {
          connect: {
            id: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessible for everyone
    const { accessible: res1 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    const { accessible: res2 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userTwoCtx
    )
    expect(res2).toBeTruthy()
    const { accessible: res3 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userThreeCtx
    )
    expect(res3).toBeTruthy()
    const { accessible: res4 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userFourCtx
    )
    expect(res4).toBeTruthy()
    const { accessible: res5 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userFiveCtx
    )
    expect(res5).toBeTruthy()

    // add LQ2 to public catalog collection with public access rights -> should be accessible to everyone
    await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: activityId2,
          catalogCollectionId: publicCatalog.id,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: activityId2,
          },
        },
        catalogCollection: {
          connect: {
            id: publicCatalog.id,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessible for everyone
    const { accessible: res6 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    const { accessible: res7 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userTwoCtx
    )
    expect(res7).toBeTruthy()
    const { accessible: res8 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userThreeCtx
    )
    expect(res8).toBeTruthy()
    const { accessible: res9 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userFourCtx
    )
    expect(res9).toBeTruthy()
    const { accessible: res10 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userFiveCtx
    )
    expect(res10).toBeTruthy()

    // add LQ3 to restricted catalog collection with public access rights -> should be accessible to users with access to the restricted catalog collection
    await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: activityId3,
          catalogCollectionId: restrictedCatalog.id,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: activityId3,
          },
        },
        catalogCollection: {
          connect: {
            id: restrictedCatalog.id,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessilbe only to users with access to restricted catalog collection
    const { accessible: res11 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userOneCtx
    )
    expect(res11).toBeTruthy() // owner of restricted catalog collection
    const { accessible: res12 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userTwoCtx
    )
    expect(res12).toBeTruthy() // read permissions on restricted catalog collection
    const { accessible: res13 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userThreeCtx
    )
    expect(res13).toBeTruthy() // write permissions on restricted catalog collection
    const { accessible: res14 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userFourCtx
    )
    expect(res14).toBeTruthy() // admin permissions on restricted catalog collection
    const { accessible: res15 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userFiveCtx
    )
    expect(res15).toBeFalsy() // no permissions on restricted catalog collection
  })

  it('Verify that users with sufficient permissions can delete the created activity templates', async () => {
    // create activity templates for testing
    const { activityId1, activityId2, activityId3 } =
      await seedLiveQuizTemplates(prisma)

    // delete activity templates with owner / admin permissions
    const res5 = await deleteActivityTemplate(
      {
        activityId: activityId1,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()
    const res6 = await deleteActivityTemplate(
      {
        activityId: activityId2,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    const res7 = await deleteActivityTemplate(
      {
        activityId: activityId3,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res7).toBeTruthy()

    // verify that the activity templates have been removed from the database
    const liveQuizTemplates = await prisma.liveQuiz.findMany({
      where: {
        status: PublicationStatus.TEMPLATE,
      },
    })
    expect(liveQuizTemplates.length).toBe(0)
  })
})
