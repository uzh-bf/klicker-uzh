import fs from 'fs'
import Turndown from 'turndown'
import { parseStringPromise } from 'xml2js'

import path from 'path'
import { fileURLToPath } from 'url'
import Prisma, { ElementType } from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'

export async function seedFlashcards(prismaClient: Prisma.PrismaClient) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

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
        options: null,
        ownerId: USER_ID_TEST,
      })),
      // ... other practice quiz properties
    }
  }

  const quizInfo = extractQuizInfo(xmlDoc)

  console.log(quizInfo.elements[0])

  const elementsFC = await Promise.all(
    quizInfo.elements.map((data) =>
      prismaClient.element.upsert({
        where: {
          originalId: data.originalId,
        },
        create: {
          ...data,
        },
        update: {
          ...data,
        },
      })
    )
  )

  const practiceQuiz = await prismaClient.practiceQuiz.upsert({
    where: {
      id: 'e0c331b1-b66e-4fc2-b352-ba14c22c294c',
    },
    create: {
      id: 'e0c331b1-b66e-4fc2-b352-ba14c22c294c',
      name: quizInfo.title,
      displayName: quizInfo.title,
      description: quizInfo.description,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      stacks: {
        create: elementsFC.map((el, ix) => ({
          order: ix,
          elementStackType: 'PRACTICE_QUIZ',
          options: {},
          elements: {
            create: {
              data: [
                {
                  order: ix,
                  type: 'PRACTICE_QUIZ',
                  elementId: el.id,
                  elementType: 'FLASHCARD',
                  elementData: el,
                  options: null,
                  results: {},
                  owner: {
                    connect: {
                      id: USER_ID_TEST,
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
