import Prisma from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants'
import { prepareQuestionInstance } from './helpers'

const { QuestionType } = Prisma

async function seed(prisma: Prisma.PrismaClient) {
  // TODO: comment safeguard for production seed
  if (process.env.ENV !== 'development') process.exit(1)

  // ! required for development testing
  //   const groupChallenge1Questions = [
  //     {
  //       id: 6178,
  //       name: 'BF1 Group Challenge 1 - Frage 1',
  //       content:
  //         'Das Finanzierungsverhältnis (FK/EK) von Novartis per Ende 2022 beträgt:',
  //       type: QuestionType.NUMERICAL,
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       options: {
  //         restrictions: {
  //           min: 0,
  //           max: 100,
  //         },
  //         accuracy: 0,
  //         unit: '%',
  //       },
  //     },
  //     {
  //       id: 6179,
  //       name: 'BF1 Group Challenge 1 - Frage 2',
  //       content:
  //         'Das Finanzierungsverhältnis (FK/EK) von Roche per Ende 2022 beträgt:',
  //       type: QuestionType.NUMERICAL,
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       options: {
  //         restrictions: {
  //           min: 0,
  //           max: 100,
  //         },
  //         accuracy: 0,
  //         unit: '%',
  //       },
  //     },
  //     {
  //       id: 6180,
  //       name: 'BF1 Group Challenge 1 - Frage 3',
  //       content:
  //         'Welche Finanzierungsstrategie hat Novartis in den letzten 2 Jahren verfolgt, und wie hat sich Novartis’ Kapitalstruktur im Vergleich zur Kapitalstruktur von Roche entwickelt? Bitte beantwortet die Frage in 3-4 Sätzen.',
  //       type: QuestionType.FREE_TEXT,
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //     },
  //     {
  //       id: 6181,
  //       name: 'BF1 Group Challenge 1 - Frage 4',
  //       content:
  //         'Welche Auswirkungen hat die Finanzierung eurer Meinung nach auf die Kapitalkosten und das Rating der beiden Unternehmen? Was sind – neben der Finanzierung – weitere mögliche Einflüsse auf die Kapitalkosten und das Rating? Bitte beantwortet die Fragen in 4-5 Sätzen.',
  //       type: QuestionType.FREE_TEXT,
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //     },
  //     {
  //       id: 6182,
  //       name: 'BF1 Group Challenge 1 - Frage 5',
  //       content:
  //         'Was sind Vorteile und Nachteile von hohen oder tiefen Finanzierungsverhältnissen (FK/EK)? Bitte beantwortet die Frage in 3-4 Sätzen.',
  //       type: QuestionType.FREE_TEXT,
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //     },
  //   ]

  //   const questionsTest = await Promise.all(
  //     groupChallenge1Questions.map((data) =>
  //       prisma.question.upsert(
  //         prepareQuestion({ ownerId: USER_ID_TEST, ...data })
  //       )
  //     )
  //   )

  // TODO: use these constants for production db seeding
  //   const USER_ID = USER_ID_BF1
  //   const COURSE_ID = COURSE_ID_BF1
  const USER_ID = USER_ID_TEST
  const COURSE_ID = COURSE_ID_TEST

  const GROUP_ACTIVITY_ID = 'df84c617-cff6-463f-b0d1-d9da611e34f0'
  const bf1GroupActivity = await prisma.groupActivity.upsert({
    where: {
      id: GROUP_ACTIVITY_ID,
    },
    create: {
      id: GROUP_ACTIVITY_ID,
      name: 'BFI Gruppenquest 1',
      displayName: 'BFI Gruppenquest 1',
      description: `
  Du und deine Finance Friends möchtet euch mit der Finanzierung von Schweizer Unternehmen beschäftigen. Hierfür wählt ihr die Pharmafirmen «Novartis» und «Roche». Um genauere Angaben der jeweiligen Finanzierungsstruktur zu erhalten, setzt ihr euch mit den Geschäftsberichten der beiden Unternehmen auseinander und nutzt die euch zugeteilten Daten.

  Für die Berechnung erhaltet ihr den folgenden Tipp:

  - Bezieht euch auf die Entwicklung der letzten 2 Jahre und konsultiert die konsolidierte Bilanz in den Geschäftsberichten der Unternehmen.

  ![](https://klickeruzhprodimages.blob.core.windows.net/b7e21ad0-dcf6-4277-9b06-a3eb1d03147c/f177ef8f-e280-4baa-88d8-d446acfe7ee0.png)
  `,
      status: 'PUBLISHED',
      scheduledStartAt: new Date('2023-10-16T13:45:00.000Z'),
      scheduledEndAt: new Date('2023-11-03T22:59:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'novartis1',
              },
            },
            create: {
              type: 'STRING',
              name: 'novartis1',
              displayName: 'Novartis Tipp 1',
              value: 'Rating (S&P / Fitch): AA-',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'novartis2',
              },
            },
            create: {
              type: 'STRING',
              name: 'novartis2',
              displayName: 'Novartis Tipp 2',
              value: 'ESG Rating (Refinitiv): B-',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'novartis3',
              },
            },
            create: {
              type: 'STRING',
              name: 'novartis3',
              displayName: 'Novartis Tipp 3',
              value: 'Kapitalkosten (WACC) approx.: 2.6%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'novartis4',
              },
            },
            create: {
              type: 'STRING',
              name: 'novartis4',
              displayName: 'Novartis Tipp 4',
              value:
                'Geschäftsbericht (S. 77): [Download](https://www.novartis.com/sites/novartis_com/files/novartis-annual-report-2022.pdf)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'roche1',
              },
            },
            create: {
              type: 'STRING',
              name: 'roche1',
              displayName: 'Roche Tipp 1',
              value: `Rating (S&P / Fitch): AA-; ESG Rating (Refinitiv): A+`,
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'roche2',
              },
            },
            create: {
              type: 'STRING',
              name: 'roche2',
              displayName: 'Roche Tipp 2',
              value: 'Kapitalkosten (WACC) approx.: 1.8%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'roche3',
              },
            },
            create: {
              type: 'STRING',
              name: 'roche3',
              displayName: 'Roche Tipp 3',
              value:
                'Geschäftsbericht (S. 46): [Download](https://assets.roche.com/f/176343/x/537a274a55/fb22e.pdf)',
            },
          },
        ],
      },
      instances: {
        connectOrCreate: await Promise.all(
          [6178, 6179, 6180, 6181, 6182].map(async (qId, ix) => {
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
          id: USER_ID,
        },
      },
      course: {
        connect: {
          id: COURSE_ID,
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
