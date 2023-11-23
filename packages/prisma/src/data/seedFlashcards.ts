import fs from 'fs'
import Turndown from 'turndown'
import { parseStringPromise } from 'xml2js'

import path from 'path'
import { fileURLToPath } from 'url'
import Prisma, {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PublicationStatus,
} from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'

const turndown = Turndown()

function extractQuizInfo(doc: typeof xmlDoc) {
  return {
    title: doc.box.title[0],
    description: doc.box.description[0],
    elements: doc.box.cards[0].card.map((card) => ({
      originalId: card['$'].id,
      name: `FC ${card['$'].id}`,
      content: turndown.turndown(card.question[0].text[0].trim()),
      explanation: turndown.turndown(card.answer[0].text[0].trim()),
      type: ElementType.FLASHCARD,
      options: {},
    })),
    // ... other practice quiz properties
  }
}

async function seedFlashcardSet(
  prismaClient: Prisma.PrismaClient,
  fileName: string,
  quizId: string
) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const USER_ID = USER_ID_TEST
  const COURSE_ID = COURSE_ID_TEST
  // const USER_ID = USER_ID_BF1_HS23
  // const COURSE_ID = COURSE_ID_BF1_HS23

  const xmlData = fs.readFileSync(path.join(__dirname, fileName), 'utf-8')

  const xmlDoc = await parseStringPromise(xmlData)

  console.log(xmlDoc, xmlDoc.box.cards[0])

  const quizInfo = extractQuizInfo(xmlDoc)

  const elementsFC = await Promise.allSettled(
    quizInfo.elements.map(async (data) => {
      const flashcard = await prismaClient.element.upsert({
        where: {
          originalId: data.originalId,
        },
        create: {
          ...data,
          owner: {
            connect: {
              id: USER_ID,
            },
          },
        },
        update: {
          ...data,
          owner: {
            connect: {
              id: USER_ID,
            },
          },
        },
      })
      return flashcard
    })
  )

  console.log(
    'created elements with value structure and status value: ',
    elementsFC[0]
  )

  if (elementsFC.some((el) => el.status === 'rejected')) {
    throw new Error('Failed to seed some flashcard elements')
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
      ownerId: USER_ID,
      courseId: COURSE_ID,
      status: PublicationStatus.PUBLISHED,
      orderType: ElementOrderType.SPACED_REPETITION,
      stacks: {
        create: elementsFC.map((el, ix) => ({
          order: ix,
          type: ElementStackType.PRACTICE_QUIZ,
          options: {},
          elements: {
            createMany: {
              data: [
                {
                  // TODO: set originalId to the "id" or "originalId" of the element
                  order: ix,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: ElementType.FLASHCARD,
                  // TODO: pick only relevant properties of the element
                  elementData: el.value,
                  options: {},
                  results: {
                    0: 0,
                    1: 0,
                    2: 0,
                    total: 0,
                  },
                  ownerId: el.value.ownerId,
                  elementId: el.value.id,
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

  console.log('successfully created practice quiz with id:', practiceQuiz.id)

  const elementStackIds = practiceQuiz.stacks.map((stack) => ({ id: stack.id }))

  // attach all element instances from the practice quiz directly to the course for repetition interface
  const course = await prismaClient.course.update({
    where: {
      id: COURSE_ID,
    },
    data: {
      elementStacks: {
        connect: elementStackIds,
      },
    },
  })

  console.log(
    'successfully attached',
    elementStackIds.length,
    'element stacks to course with id:',
    course.id
  )

  return elementsFC
}

export async function seedFlashcards(prismaClient: Prisma.PrismaClient) {
  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_1.xml',
    'e0c331b1-b66e-4fc2-b352-ba14c22c294c'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_2.xml',
    '36eba4d8-fa0d-46bc-b916-b53ba56637b8'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_3.xml',
    '9bdb2760-e631-4e00-9604-9d807a4f47a2'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_4.xml',
    'e0760993-18e1-467a-b84f-591c1b81e727'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_5.xml',
    '1c699242-3740-4c05-b853-86e8d824997e'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_6.xml',
    '35334e99-331d-481e-bd32-c84cddaf8764'
  )

  await seedFlashcardSet(
    prismaClient,
    'data/FC_Modul_7.xml',
    'd6a1f040-a78a-43ac-8778-bfc0f5b6e86c'
  )
}

// if main module, run this
const prismaClient = new Prisma.PrismaClient()
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
