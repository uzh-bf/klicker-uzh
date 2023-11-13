import Prisma from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants'
import { prepareQuestion, prepareQuestionInstance } from './helpers'

const { ElementType } = Prisma

async function seed(prisma: Prisma.PrismaClient) {
  // TODO: comment safeguard for production seed
  if (process.env.ENV !== 'development') process.exit(1)

  // ! required for development testing
  const groupChallenge1Questions = [
    {
      id: 6178,
      originalId: '6178',
      name: 'BF1 Group Challenge 1 - Frage 1',
      content:
        'Das Finanzierungsverhältnis (FK/EK) von Novartis per Ende 2022 beträgt:',
      type: ElementType.NUMERICAL,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      options: {
        restrictions: {
          min: 0,
          max: 100,
        },
        accuracy: 0,
        unit: '%',
      },
    },
    {
      id: 6179,
      originalId: '6179',
      name: 'BF1 Group Challenge 1 - Frage 2',
      content:
        'Das Finanzierungsverhältnis (FK/EK) von Roche per Ende 2022 beträgt:',
      type: ElementType.NUMERICAL,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      options: {
        restrictions: {
          min: 0,
          max: 100,
        },
        accuracy: 0,
        unit: '%',
      },
    },
    {
      id: 6180,
      originalId: '6180',
      name: 'BF1 Group Challenge 1 - Frage 3',
      content:
        'Welche Finanzierungsstrategie hat Novartis in den letzten 2 Jahren verfolgt, und wie hat sich Novartis’ Kapitalstruktur im Vergleich zur Kapitalstruktur von Roche entwickelt? Bitte beantwortet die Frage in 3-4 Sätzen.',
      type: ElementType.FREE_TEXT,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
    },
    {
      id: 6181,
      originalId: '6181',
      name: 'BF1 Group Challenge 1 - Frage 4',
      content:
        'Welche Auswirkungen hat die Finanzierung eurer Meinung nach auf die Kapitalkosten und das Rating der beiden Unternehmen? Was sind – neben der Finanzierung – weitere mögliche Einflüsse auf die Kapitalkosten und das Rating? Bitte beantwortet die Fragen in 4-5 Sätzen.',
      type: ElementType.FREE_TEXT,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
    },
    {
      id: 6182,
      originalId: '6182',
      name: 'BF1 Group Challenge 1 - Frage 5',
      content:
        'Was sind Vorteile und Nachteile von hohen oder tiefen Finanzierungsverhältnissen (FK/EK)? Bitte beantwortet die Frage in 3-4 Sätzen.',
      type: ElementType.FREE_TEXT,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
    },
  ]

  const questionsTest = await Promise.all(
    groupChallenge1Questions.map((data) =>
      prisma.element.upsert(prepareQuestion({ ownerId: USER_ID_TEST, ...data }))
    )
  )

  // TODO: use these constants for production db seeding
  //   const USER_ID = USER_ID_BF1_HS23
  //   const COURSE_ID = COURSE_ID_BF1_HS23
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
            const question = await prisma.element.findUnique({
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

  // const GROUP_ACTIVITY_ID2 = 'd63dbdbd-f99b-4359-917e-d3ad4248e5f7'
  // const bf1GroupActivity2 = await prisma.groupActivity.upsert({
  //   where: {
  //     id: GROUP_ACTIVITY_ID2,
  //   },
  //   create: {
  //     id: GROUP_ACTIVITY_ID2,
  //     name: 'BFI Gruppenquest 2: Unternehmensbewertung',
  //     displayName: 'BFI Gruppenquest 2: Unternehmensbewertung',
  //     description: `
  // Du und deine Kolleg:innen arbeiten gemeinsam in einem Corporate Finance Büro - der WeValYou AG. Am Montag kommt Herr S. Räfli auf euch zu und beauftragt euch, im Rahmen des potenziellen Kaufs der **Schindler AG**, ihren Unternehmenswert anhand verschiedener Berechnungsmethoden zu bestimmen.

  // Er bringt eine grosse Box an Unterlagen mit. Leider aber fällt die Box auf den Boden, ein Windstoss kommt und die Unterlagen fliegen wild umher. Jede:r von euch schafft es, einige Blätter zu sammeln und hält nun also unterschiedliche Angaben zur Schindler AG in der Hand. Sprecht euch untereinander ab, um alle Daten zusammenzutragen.

  // Für die Aufgaben gibt euch Herr S. Räfli noch die folgenden Tipps:

  // - Berechnet den Unternehmenswert jeweils per 31.12.2022.

  // - Die erhaltenen Daten sind alle per Ende 2022.

  // ![](https://klickeruzhprodimages.blob.core.windows.net/b7e21ad0-dcf6-4277-9b06-a3eb1d03147c/3d6d1889-b2ff-4a98-90a1-9b119968a82d.png)
  // `,
  //     status: 'PUBLISHED',
  //     scheduledStartAt: new Date('2023-11-08T17:00:00.000Z'),
  //     scheduledEndAt: new Date('2023-11-24T22:59:00.000Z'),
  //     parameters: {},
  //     clues: {
  //       connectOrCreate: [
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'eigenkapitalrendite',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'eigenkapitalrendite',
  //             displayName: 'Eigenkapitalrendite',
  //             value: 'Wert: 9%',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'fremdkapitalkosten',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'fremdkapitalkosten',
  //             displayName: 'Fremdkapitalkosten',
  //             value: 'Wert: 5%',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'fremdkapital',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'fremdkapital',
  //             displayName: 'Fremdkapital',
  //             value: 'Wert: 7363 Mio. CHF',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'eigenkapital',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'eigenkapital',
  //             displayName: 'Eigenkapital',
  //             value: 'Wert: 4445 Mio. CHF',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'aktien',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'aktien',
  //             displayName: 'Anzahl Aktien',
  //             value: 'Wert: 67077452',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'aktienkurs',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'aktienkurs',
  //             displayName: 'Aktienkurs Ende 2022',
  //             value: 'Wert: 173.9 CHF',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID2,
  //               name: 'reingewinn',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'reingewinn',
  //             displayName: 'Reingewinn',
  //             value: 'Wert: 659 Mio. CHF',
  //           },
  //         },
  //       ],
  //     },
  //     instances: {
  //       connectOrCreate: await Promise.all(
  //         // TODO: change question ids to production question ids
  //         [8782, 8783, 8784, 8785, 8786, 8787].map(async (qId, ix) => {
  //           const question = await prisma.element.findUnique({
  //             where: { id: qId },
  //           })

  //           return {
  //             where: {
  //               type_groupActivityId_order: {
  //                 type: 'GROUP_ACTIVITY',
  //                 groupActivityId: GROUP_ACTIVITY_ID2,
  //                 order: ix,
  //               },
  //             },
  //             create: prepareQuestionInstance({
  //               question,
  //               type: 'GROUP_ACTIVITY',
  //               order: ix,
  //             }),
  //           }
  //         })
  //       ),
  //     },
  //     owner: {
  //       connect: {
  //         id: USER_ID,
  //       },
  //     },
  //     course: {
  //       connect: {
  //         id: COURSE_ID,
  //       },
  //     },
  //   },
  //   update: {},
  // })

  const GROUP_ACTIVITY_INSTANCE_RESULTS: Record<
    number,
    { points: number; maxPoints: number; message: string }
  > = {
    1: {
      points: 1,
      maxPoints: 1,
      message: 'Message would go here...',
    },
  }

  const groupActivityInstances1 = await prisma.groupActivityInstance.findMany({
    // check if id is in  Object.keys(GROUP_ACTIVITY_INSTANCE_RESULTS_TEST)
    where: {
      id: {
        // TODO: replace this by production group activity instance ids
        in: [1],
      },
    },
    include: {
      group: {
        include: {
          participants: true,
        },
      },
    },
  })

  let promises = []
  for (const [key, value] of Object.entries(GROUP_ACTIVITY_INSTANCE_RESULTS)) {
    promises.push(
      prisma.groupActivityInstance.update({
        where: {
          id: parseInt(key),
        },
        data: {
          results: value,
        },
      })
    )
  }

  // create a map between participants and achievements
  const participantAchievementMap = groupActivityInstances1.reduce<
    Record<string, number[]>
  >((acc, instance) => {
    const { points, maxPoints } = GROUP_ACTIVITY_INSTANCE_RESULTS[instance.id]

    instance.group.participants.forEach((participant) => {
      acc[participant.id] = [9]
      if (points / maxPoints >= 0.5) {
        acc[participant.id].push(8)
      }
    })

    return acc
  }, {})

  // achieve the instances for the participants and add this to the promises
  Object.entries(participantAchievementMap).forEach(
    ([participantId, achievementIds]) => {
      achievementIds.forEach((id) => {
        promises.push(
          prisma.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: participantId,
                achievementId: id,
              },
            },
            create: {
              participantId: participantId,
              achievementId: id,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {
              achievedCount: {
                increment: 1,
              },
            },
          })
        )
      })
    }
  )

  await prisma.$transaction(promises)
}

const prismaClient = new Prisma.PrismaClient()

await seed(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
