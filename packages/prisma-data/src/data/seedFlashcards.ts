import {
  type Element,
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'
import { prepareFlashcardsFromFile, processQuizInfo } from './helpers.js'

async function seedFlashcardSet(
  prismaClient: PrismaClient,
  fileName: string,
  quizId: string,
  elements: Element[],
  userId: string,
  courseId: string
) {
  const quizInfo = await processQuizInfo(fileName)
  const practiceQuiz = await prismaClient.practiceQuiz.upsert({
    where: { id: quizId },
    create: {
      id: quizId,
      name: quizInfo.title,
      displayName: quizInfo.title,
      description: quizInfo.description,
      ownerId: userId,
      courseId,
      status: PublicationStatus.DRAFT,
      orderType: ElementOrderType.SPACED_REPETITION,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: elements.map((el, ix) => {
          const elementData = processElementData(el)
          const initialResults = getInitialInstanceResults(elementData)

          return {
            order: ix,
            type: ElementStackType.PRACTICE_QUIZ,
            elements: {
              createMany: {
                data: [
                  {
                    order: ix,
                    type: ElementInstanceType.PRACTICE_QUIZ,
                    elementType: ElementType.FLASHCARD,
                    elementData,
                    options: { resetTimeDays: 7 },
                    results: initialResults,
                    anonymousResults: initialResults,
                    ownerId: el.ownerId,
                    elementId: el.id,
                    instanceStatistics: {
                      create: getInitialInstanceStatistics(
                        ElementInstanceType.PRACTICE_QUIZ
                      ),
                    },
                  },
                ],
              },
            },
          }
        }),
      },
    },
    update: {},
  })

  await recomputeDerivedPermissions(
    {
      practiceQuizId: quizId,
      userId,
    },
    prismaClient
  )

  return practiceQuiz
}

export async function seedFlashcards(prismaClient: PrismaClient) {
  const USER_ID = USER_ID_TEST
  const COURSE_ID = COURSE_ID_TEST
  const COURSE_TAG_NAME = 'BF1 Flashcards'

  const formulaTag = await prismaClient.tag.upsert({
    where: { ownerId_name: { ownerId: USER_ID, name: 'Formula' } },
    create: { name: 'Formula', owner: { connect: { id: USER_ID } } },
    update: {},
  })

  const courseTag = await prismaClient.tag.upsert({
    where: { ownerId_name: { ownerId: USER_ID, name: COURSE_TAG_NAME } },
    create: { name: COURSE_TAG_NAME, owner: { connect: { id: USER_ID } } },
    update: {},
  })

  const FORMULA_TAG_ID = formulaTag.id
  const COURSE_TAG_ID = courseTag.id

  // const flashcards1 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/BF2_FC_Modul_1.xml',
  //   USER_ID,
  //   FORMULA_TAG_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/BF2_FC_Modul_1.xml',
  //   '165b31d7-30d8-4be4-874d-56d379cf7bea',
  //   flashcards1,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards2 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/BF2_FC_Modul_2.xml',
  //   USER_ID,
  //   FORMULA_TAG_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/BF2_FC_Modul_2.xml',
  //   'aea11c66-c8f4-4cbc-b3da-b54ccd38dc42',
  //   flashcards2,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards3 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/BF2_FC_Modul_3.xml',
  //   USER_ID,
  //   FORMULA_TAG_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/BF2_FC_Modul_3.xml',
  //   'e6e86ea0-ed35-4aee-8c1b-77f66f603b78',
  //   flashcards3,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards4 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/BF2_FC_Modul_4.xml',
  //   USER_ID,
  //   FORMULA_TAG_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/BF2_FC_Modul_4.xml',
  //   'dd24f312-58fb-4279-a1ab-61120b8fc67d',
  //   flashcards4,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards5 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/BF2_FC_Modul_5.xml',
  //   USER_ID,
  //   FORMULA_TAG_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/BF2_FC_Modul_5.xml',
  //   '2d5fd2be-738f-4d71-8841-e356e3222825',
  //   flashcards5,
  //   USER_ID,
  //   COURSE_ID
  // )

  const flashcards1 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_1.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_1.xml',
    'a0cad323-81f5-4cda-8594-058b5242f790',
    flashcards1,
    USER_ID,
    COURSE_ID
  )

  const flashcards2 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_2.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_2.xml',
    '9d1264c9-4286-4850-b350-b26a7f8bf2cf',
    flashcards2,
    USER_ID,
    COURSE_ID
  )

  const flashcards3 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_3.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_3.xml',
    '1e829703-f67e-4524-863a-432e6fa6c2ab',
    flashcards3,
    USER_ID,
    COURSE_ID
  )

  const flashcards4 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_4.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_4.xml',
    'a6ab0933-5d70-45e9-afeb-af87285975c2',
    flashcards4,
    USER_ID,
    COURSE_ID
  )

  const flashcards5 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_5.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_5.xml',
    '0cc5dbb8-699a-42e4-9634-2f40ea40a4e4',
    flashcards5,
    USER_ID,
    COURSE_ID
  )

  const flashcards6 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_6.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_6.xml',
    '58fb31fe-444a-44f7-b0e4-6f956ff7f1da',
    flashcards6,
    USER_ID,
    COURSE_ID
  )

  const flashcards7 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/FC_Modul_7.xml',
    USER_ID,
    FORMULA_TAG_ID,
    COURSE_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_7.xml',
    '422f57ba-c25c-4ed8-be13-b7e3c7d560d3',
    flashcards7,
    USER_ID,
    COURSE_ID
  )
}

// if main module, run this
const prismaClient = new PrismaClient()
// @ts-ignore
await seedFlashcards(prismaClient)
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
