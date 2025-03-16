import {
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PermissionStatus,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getAnswerCollectionsElements,
  getAnswerCollectionsInfo,
} from '../src/services/resources.js'
import { MISSING_CATALOG_COLLECTION_ID } from '../src/services/sharing.js'
import { getMatchingUserElementsTemplate } from '../src/services/templates.js'
import { questionsSLAF, userOne, userTwo } from './templateData.js'

// setup test database configuration
// use the DATABASE_URL environment variable if available (for CI or local dev)
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // as a fallback, use default PostgreSQL connection
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

describe('Unit tests for sharing service', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    // configure database
    const databaseUrl = getDatabaseUrl()

    try {
      // initialize PrismaClient with the database URL
      prisma = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
        log: ['error', 'warn'],
      })

      // test database connection
      await prisma.$connect()

      // create EventEmitter for test context
      emitter = new EventEmitter()

      // upsert all users in the database
      const users = await Promise.all(
        [userOne, userTwo].map(
          async (user) =>
            await prisma.user.upsert({
              where: { id: user.id },
              update: {},
              create: {
                id: user.id,
                email: user.email,
                shortname: user.shortname,
              },
            })
        )
      )

      // mock context with user including all required properties
      userOneCtx = {
        user: {
          sub: userOne.sub,
          role: UserRole.USER,
          scope: UserLoginScope.ACCOUNT_OWNER,
          catalystInstitutional: true,
          catalystIndividual: true,
        },
        prisma,
        emitter,
        redisExec: jest.fn() as unknown as ContextWithUser['redisExec'],
        pubSub: { publish: jest.fn(), subscribe: jest.fn() },
        req: {} as any,
        res: {} as any,
      }

      // mock remaining contexts
      userTwoCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userTwo.sub },
      }
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // disconnect from the database
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('Verify that matching questions are correctly filtered when loaded from the database', async () => {
    // seed a number of minimal elements into the database
    const elements = await Promise.all(
      questionsSLAF.map(async (question) => {
        return await prisma.element.create({
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

    // cleanup: delete all elements from the database
    const elementIds = elements.map((element) => element.id)
    await prisma.element.deleteMany({ where: { id: { in: elementIds } } })
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
        permissions: {
          create: {
            permissionLevel: PermissionLevel.READ,
            permissionStatus: PermissionStatus.REQUESTED, // requested permissions should not affect access
            user: { connect: { id: userTwo.id } },
          },
        },
      },
    })

    // create unshared answer collection for user 1 (not used in activity template)
    const AC2 = await prisma.answerCollection.create({
      data: {
        name: 'AC2',
        description: '',
        owner: { connect: { id: userOne.id } },
      },
    })

    // create answer collection for user 1 (shared with user 2, used in activity template)
    const AC3 = await prisma.answerCollection.create({
      data: {
        name: 'AC3',
        description: '',
        owner: { connect: { id: userOne.id } },
        permissions: {
          create: {
            permissionLevel: PermissionLevel.READ,
            permissionStatus: PermissionStatus.GRANTED,
            user: { connect: { id: userTwo.id } },
          },
        },
      },
    })

    // create answer collection for user 1 (shared with user 2, not used in activity template)
    const AC4 = await prisma.answerCollection.create({
      data: {
        name: '',
        description: '',
        owner: { connect: { id: userOne.id } },
        permissions: {
          create: {
            permissionLevel: PermissionLevel.WRITE,
            permissionStatus: PermissionStatus.GRANTED,
            user: { connect: { id: userTwo.id } },
          },
        },
      },
    })

    // create unshared answer collection for user 2
    const AC5 = await prisma.answerCollection.create({
      data: {
        name: '',
        description: '',
        owner: { connect: { id: userTwo.id } },
      },
    })

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
    const template = await prisma.activityTemplate.create({
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

    // queries not related to the template should still only return owned or directly shared answer collections
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

    // cleanup; delete the created answer collections and the template
    await prisma.liveQuiz.delete({ where: { id: activityId } })
    await prisma.answerCollection.deleteMany({
      where: { id: { in: [AC1.id, AC2.id, AC3.id, AC4.id, AC5.id] } },
    })
    const templateCount = await prisma.activityTemplate.count()
    expect(templateCount).toBe(0)
    const liveQuizCount = await prisma.liveQuiz.count()
    expect(liveQuizCount).toBe(0)
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
  })

  it('Cleanup: delete all created data used in this unit test', async () => {
    // verify that all elements have been deleted already
    const dbElements = await prisma.element.count()
    expect(dbElements).toBe(0)

    // delete all users that have been created for the test and validate that they have been removed
    await prisma.user.deleteMany({
      where: {
        id: { in: [userOne.id, userTwo.id] },
      },
    })
    const dbUsers = await prisma.user.count()
    expect(dbUsers).toBe(0)
  })
})
