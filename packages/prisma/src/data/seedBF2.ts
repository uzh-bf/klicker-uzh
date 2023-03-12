import Prisma from '@klicker-uzh/prisma'
import { Question } from '../client/index.js'
import { COURSE_ID_BF2, USER_ID_BF2 } from './constants.js'
import * as DATA_BF2 from './data/BF2.js'
import { prepareLearningElement, prepareQuestionInstance } from './helpers.js'

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  const questions = await prisma.question.findMany({
    orderBy: { id: 'desc' },
    where: {
      ownerId: USER_ID_BF2,
    },
  })

  const learningElements = await Promise.all(
    DATA_BF2.LEARNING_ELEMENTS.map(async (data) =>
      prisma.learningElement.upsert(
        await prepareLearningElement({
          ...data,
          ownerId: USER_ID_BF2,
          courseId: COURSE_ID_BF2,
          stacks: data.stacks.map((stack) => {
            return {
              ...stack,
              elements: stack.elements.map((element) => {
                if (typeof element !== 'string') {
                  return questions.find((q) => q.id === element) as Question
                }
                return element
              }),
            }
          }),
        })
      )
    )
  )

  const GROUP_ACTIVITY_ID = 'b83657a5-4d19-449d-b378-208b7cb2e8e0'
  const groupActivity1BF2 = await prisma.groupActivity.upsert({
    where: {
      id: GROUP_ACTIVITY_ID,
    },
    create: {
      id: GROUP_ACTIVITY_ID,
      name: 'BFII Gruppenquest 1',
      displayName: 'BFII Gruppenquest 1',
      description: `
![](https://sos-ch-dk-2.exo.io/klicker-prod/img/bf2/bf2_group_activity_1.png)

Du und deine Kolleg:innen bonden oft über Bonds. Auch heute seid ihr zusammengekommen, um aktuelle Anleihen zu untersuchen und einen Bond zu wählen, den ihr kaufen werdet. Zur Auswahl stehen die euch zugeteilten Anleihen. Um genauere Angaben zu den Bonds zu finden, durchsucht ihr die Marktdaten der SIX unter folgendem Link:

[Marktdaten der SIX](https://www.six-group.com/de/products-services/the-swiss-stock-exchange/market-data/bonds/bond-explorer.html)

Für die Aufgaben geben wir euch noch die folgenden Tipps:

1. Denomination kann als Synonym von Nennwert verstanden werden.
2. Auch das Rating der jeweiligen Anleihen sollte ein wichtiger Indikator für eure Entscheidung sein.
`,
      scheduledStartAt: new Date('2023-03-10T11:00:00.000Z'),
      scheduledEndAt: new Date('2023-03-17T11:00:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond1',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond1',
              displayName: 'Bond 1',
              value: 'Schweizer Eidgenossenschaft, CH0009755197',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond2',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond2',
              displayName: 'Bond 2',
              value: 'Credit Suisse, CH0591979668',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond3',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond3',
              displayName: 'Bond 3',
              value: 'Kinderspital Zürich, CH0326213912',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond4',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond4',
              displayName: 'Bond 4',
              value: 'Holcim, CH1154887140',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond5',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond5',
              displayName: 'Bond 5',
              value: 'Givaudan, CH0237552101',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond6',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond6',
              displayName: 'Bond 6',
              value: 'Lindt, CH0564642079',
            },
          },
        ],
      },
      instances: {
        connectOrCreate: await Promise.all(
          [655, 656, 657, 658].map(async (qId, ix) => {
            const question = await prisma.question.findUnique({
              where: { id: qId },
            })

            return {
              where: {
                type_groupActivityId_order: {
                  type: 'GROUP_ACTIVITY',
                  groupActivityId: GROUP_ACTIVITY_ID,
                  order: ix,
                },
              },
              create: prepareQuestionInstance({
                question,
                type: 'GROUP_ACTIVITY',
                order: ix,
              }),
            }
          })
        ),
      },
      owner: {
        connect: {
          id: USER_ID_BF2,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_BF2,
        },
      },
    },
    update: {},
  })
}

const prismaClient = new Prisma.PrismaClient()

seed(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
