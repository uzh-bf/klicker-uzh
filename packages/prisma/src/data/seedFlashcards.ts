import { v4 as uuidv4 } from 'uuid'
import Prisma, {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PublicationStatus,
} from '../../dist/index.js'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'
import { prepareFlashcardsFromFile, processQuizInfo } from './helpers.js'

async function seedFlashcardSet(
  prismaClient: Prisma.PrismaClient,
  fileName: string,
  quizId: string,
  elements: Prisma.Element[],
  userId: string,
  courseId: string
) {
  const quizInfo = await processQuizInfo(fileName)

  const initialResults = {
    CORRECT: 0,
    PARTIAL: 0,
    INCORRECT: 0,
    total: 0,
  }
  const practiceQuiz = await prismaClient.practiceQuiz.upsert({
    where: {
      id: quizId,
    },
    create: {
      id: quizId,
      name: quizInfo.title,
      displayName: quizInfo.title,
      description: quizInfo.description,
      ownerId: userId,
      courseId: courseId,
      status: PublicationStatus.PUBLISHED,
      orderType: ElementOrderType.SPACED_REPETITION,
      stacks: {
        create: elements.map((el, ix) => ({
          order: ix,
          type: ElementStackType.PRACTICE_QUIZ,
          options: {},
          course: {
            connect: {
              id: courseId,
            },
          },
          elements: {
            createMany: {
              data: [
                {
                  migrationId: el.originalId ?? uuidv4(),
                  originalId: el.originalId,
                  order: ix,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: ElementType.FLASHCARD,
                  elementData: el,
                  options: {},
                  results: initialResults,
                  anonymousResults: initialResults,
                  ownerId: el.ownerId,
                  elementId: el.id,
                },
              ],
            },
          },
        })),
      },
    },
    update: {},
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  return practiceQuiz
}

export async function seedFlashcards(prismaClient: Prisma.PrismaClient) {
  const USER_ID = USER_ID_TEST
  const COURSE_ID = COURSE_ID_TEST

  const formulaTag = await prismaClient.tag.upsert({
    where: {
      ownerId_name: {
        ownerId: USER_ID,
        name: 'Formula',
      },
    },
    create: {
      name: 'Formula',
      owner: {
        connect: {
          id: USER_ID,
        },
      },
    },
    update: {},
  })

  const FORMULA_TAG_ID = formulaTag.id

  const flashcards1 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/BF2_FC_Modul_1.xml',
    USER_ID,
    FORMULA_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/BF2_FC_Modul_1.xml',
    '165b31d7-30d8-4be4-874d-56d379cf7bea',
    flashcards1,
    USER_ID,
    COURSE_ID
  )

  const flashcards2 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/BF2_FC_Modul_2.xml',
    USER_ID,
    FORMULA_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/BF2_FC_Modul_2.xml',
    'aea11c66-c8f4-4cbc-b3da-b54ccd38dc42',
    flashcards2,
    USER_ID,
    COURSE_ID
  )

  const flashcards3 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/BF2_FC_Modul_3.xml',
    USER_ID,
    FORMULA_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/BF2_FC_Modul_3.xml',
    'e6e86ea0-ed35-4aee-8c1b-77f66f603b78',
    flashcards3,
    USER_ID,
    COURSE_ID
  )

  const flashcards4 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/BF2_FC_Modul_4.xml',
    USER_ID,
    FORMULA_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/BF2_FC_Modul_4.xml',
    'dd24f312-58fb-4279-a1ab-61120b8fc67d',
    flashcards4,
    USER_ID,
    COURSE_ID
  )

  const flashcards5 = await prepareFlashcardsFromFile(
    prismaClient,
    'data/BF2_FC_Modul_5.xml',
    USER_ID,
    FORMULA_TAG_ID
  )
  await seedFlashcardSet(
    prismaClient,
    'data/BF2_FC_Modul_5.xml',
    '2d5fd2be-738f-4d71-8841-e356e3222825',
    flashcards5,
    USER_ID,
    COURSE_ID
  )

  // const flashcards1 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_1.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_1.xml',
  //   'e0c331b1-b66e-4fc2-b352-ba14c22c294c',
  //   flashcards1,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards2 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_2.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_2.xml',
  //   '36eba4d8-fa0d-46bc-b916-b53ba56637b8',
  //   flashcards2,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards3 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_3.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_3.xml',
  //   '9bdb2760-e631-4e00-9604-9d807a4f47a2',
  //   flashcards3,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards4 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_4.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_4.xml',
  //   'e0760993-18e1-467a-b84f-591c1b81e727',
  //   flashcards4,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards5 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_5.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_5.xml',
  //   '1c699242-3740-4c05-b853-86e8d824997e',
  //   flashcards5,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards6 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_6.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_6.xml',
  //   '35334e99-331d-481e-bd32-c84cddaf8764',
  //   flashcards6,
  //   USER_ID,
  //   COURSE_ID
  // )

  // const flashcards7 = await prepareFlashcardsFromFile(
  //   prismaClient,
  //   'data/FC_Modul_7.xml',
  //   USER_ID
  // )
  // await seedFlashcardSet(
  //   prismaClient,
  //   'data/FC_Modul_7.xml',
  //   'd6a1f040-a78a-43ac-8778-bfc0f5b6e86c',
  //   flashcards7,
  //   USER_ID,
  //   COURSE_ID
  // )
}

// if main module, run this
const prismaClient = new Prisma.PrismaClient()
// @ts-ignore
await seedFlashcards(prismaClient)
  .then((res) => {
    console.log('res', res)
  })
  .catch((err) => {
    console.error(err)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
