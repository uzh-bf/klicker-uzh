import fs from 'fs'
import Turndown from 'turndown'
import { parseStringPromise } from 'xml2js'

import path from 'path'
import { fileURLToPath } from 'url'
import Prisma, {
  ElementInstanceType,
  ElementStackType,
  ElementType,
} from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'

export async function seedFlashcards(prismaClient: Prisma.PrismaClient) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  // TODO: change these IDs for production seeding
  const USER_ID = USER_ID_TEST
  const COURSE_ID = COURSE_ID_TEST

  const xmlData = fs.readFileSync(
    path.join(__dirname, 'data/FC_Modul_1.xml'),
    'utf-8'
  )

  const xmlDoc = await parseStringPromise(xmlData)

  console.log(xmlDoc, xmlDoc.box.cards[0])

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
      id: 'e0c331b1-b66e-4fc2-b352-ba14c22c294c',
    },
    create: {
      id: 'e0c331b1-b66e-4fc2-b352-ba14c22c294c',
      name: quizInfo.title,
      displayName: quizInfo.title,
      description: quizInfo.description,
      ownerId: USER_ID,
      courseId: COURSE_ID,
      stacks: {
        create: elementsFC.map((el, ix) => ({
          order: ix,
          type: ElementStackType.PRACTICE_QUIZ,
          options: {},
          elements: {
            createMany: {
              data: [
                {
                  order: ix,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: ElementType.FLASHCARD,
                  // TODO: pick only relevant properties of the element
                  elementData: el.value,
                  options: {},
                  results: {},
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

  const elementInstanceIds = practiceQuiz.stacks.flatMap((stack) =>
    stack.elements.flatMap((instance) => instance.id)
  )

  // attach all element instances from the practice quiz directly to the course for repetition interface
  const course = await prismaClient.course.update({
    where: {
      id: COURSE_ID,
    },
    data: {
      elementInstances: {
        connect: elementInstanceIds.map((id) => ({
          id,
        })),
      },
    },
  })

  console.log(
    'successfully attached',
    elementInstanceIds.length,
    'element instances to course with id:',
    course.id
  )

  return elementsFC
}

// if main module, run this
const prismaClient = new Prisma.PrismaClient()
seedFlashcards(prismaClient)
  .then((res) => {
    console.log('res', res)
  })
  .catch((err) => {
    console.error(err)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
