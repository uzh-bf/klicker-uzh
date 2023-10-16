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

  console.log(quizInfo.elements)

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
      // TODO: remove debugging output
      console.log(`id: ${flashcard.id}, originalId: ${flashcard.originalId}`)
      return flashcard
    })
  )

  // TODO: remove debugging content
  console.log('seeded elements', elementsFC)

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
      courseId: COURSE_ID_TEST,
      stacks: {
        create: elementsFC.map((el, ix) => ({
          order: ix,
          type: ElementStackType.PRACTICE_QUIZ,
          options: {},
          elements: {
            create: {
              data: [
                {
                  order: ix,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: ElementType.FLASHCARD,
                  // TODO: pick only relevant properties of the element
                  elementData: el.value,
                  options: null,
                  results: {},
                  owner: {
                    connect: {
                      id: USER_ID,
                    },
                  },
                  element: {
                    connect: {
                      id: el.value.id,
                    },
                  },
                },
              ],
            },
          },
        })),
      },
    },
    update: {},
  })

  console.log(practiceQuiz)

  // TODO: attach all element instances from the practice quiz directly to the course
  // TODO: practice interface shows all of the instances attached to the course

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
