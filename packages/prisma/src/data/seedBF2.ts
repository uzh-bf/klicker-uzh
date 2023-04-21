import Prisma from '@klicker-uzh/prisma'
// import * as R from 'ramda'
// import { COURSE_ID_BF2, USER_ID_BF2 } from './constants.js'
// import { prepareQuestionInstance } from './helpers.js'

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  // const questions = await prisma.question.findMany({
  //   orderBy: { id: 'desc' },
  //   where: {
  //     ownerId: USER_ID_BF2,
  //   },
  // })

  // const learningElements = await Promise.all(
  //   DATA_BF2.LEARNING_ELEMENTS.map(async (data) =>
  //     prisma.learningElement.upsert(
  //       await prepareLearningElement({
  //         ...data,
  //         ownerId: USER_ID_BF2,
  //         courseId: COURSE_ID_BF2,
  //         stacks: data.stacks.map((stack, index) => {
  //           return {
  //             ...stack,
  //             elements: stack.elements.map((element) => {
  //               if (typeof element !== 'string') {
  //                 return questions.find((q) => q.id === element) as Question
  //               }
  //               return element
  //             }),
  //           }
  //         }),
  //       })
  //     )
  //   )
  // )

  // const GROUP_ACTIVITY_ID = 'b83657a5-4d19-449d-b378-208b7cb2e8e0'
  // const groupActivity1BF2 = await prisma.groupActivity.upsert({
  //   where: {
  //     id: GROUP_ACTIVITY_ID,
  //   },
  //   create: {
  //     id: GROUP_ACTIVITY_ID,
  //     name: 'BFII Gruppenquest 1',
  //     displayName: 'BFII Gruppenquest 1',
  //     description: `
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/img/bf2/bf2_group_activity_1.png)

  // Du und deine Kolleg:innen bonden oft über Bonds. Auch heute seid ihr zusammengekommen, um aktuelle Anleihen zu untersuchen und einen Bond zu wählen, den ihr kaufen werdet. Zur Auswahl stehen die euch zugeteilten Anleihen. Um genauere Angaben zu den Bonds zu finden, durchsucht ihr die Marktdaten der SIX unter folgendem Link:

  // [Marktdaten der SIX](https://www.six-group.com/de/products-services/the-swiss-stock-exchange/market-data/bonds/bond-explorer.html)

  // Für die Aufgaben geben wir euch noch die folgenden Tipps:

  // 1. Denomination kann als Synonym von Nennwert verstanden werden.
  // 2. Auch das Rating der jeweiligen Anleihen sollte ein wichtiger Indikator für eure Entscheidung sein.
  // `,
  //     scheduledStartAt: new Date('2023-03-10T11:00:00.000Z'),
  //     scheduledEndAt: new Date('2023-03-17T11:00:00.000Z'),
  //     parameters: {},
  //     clues: {
  //       connectOrCreate: [
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond1',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond1',
  //             displayName: 'Bond 1',
  //             value: 'Schweizer Eidgenossenschaft, CH0009755197',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond2',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond2',
  //             displayName: 'Bond 2',
  //             value: 'Credit Suisse, CH0591979668',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond3',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond3',
  //             displayName: 'Bond 3',
  //             value: 'Kinderspital Zürich, CH0326213912',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond4',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond4',
  //             displayName: 'Bond 4',
  //             value: 'Holcim, CH1154887140',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond5',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond5',
  //             displayName: 'Bond 5',
  //             value: 'Givaudan, CH0237552101',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'bond6',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'bond6',
  //             displayName: 'Bond 6',
  //             value: 'Lindt, CH0564642079',
  //           },
  //         },
  //       ],
  //     },
  //     instances: {
  //       connectOrCreate: await Promise.all(
  //         [655, 656, 657, 658].map(async (qId, ix) => {
  //           const question = await prisma.question.findUnique({
  //             where: { id: qId },
  //           })

  //           return {
  //             where: {
  //               type_groupActivityId_order: {
  //                 type: 'GROUP_ACTIVITY',
  //                 groupActivityId: GROUP_ACTIVITY_ID,
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
  //         id: USER_ID_BF2,
  //       },
  //     },
  //     course: {
  //       connect: {
  //         id: COURSE_ID_BF2,
  //       },
  //     },
  //   },
  //   update: {},
  // })

  // const GROUP_ACTIVITY_ID = '9f5850a4-f58d-4144-94d6-68adb3ab0466'
  // const groupActivity1BF2 = await prisma.groupActivity.upsert({
  //   where: {
  //     id: GROUP_ACTIVITY_ID,
  //   },
  //   create: {
  //     id: GROUP_ACTIVITY_ID,
  //     name: 'BFII Gruppenquest 2',
  //     displayName: 'BFII Gruppenquest 2',
  //     description: `
  // ![](https://sos-ch-dk-2.exo.io/klicker-prod/img/bf2/bf2_group_activity_2.png)

  // Du und deine Kolleg:innen sharen euer Wissen über Shares. Auch heute seid ihr zusammengekommen, um aktuelle Aktien zu analysieren und eine auszuwählen, welche ihr kaufen werdet. Zur Auswahl stehen die folgenden Aktientitel der Pharmabranche:

  // - Novartis AG (NOVN.SW)
  // - Sanofi (SNY)
  // - Bristol-Myers Squibb Company (BMY)

  // Um genauere Angaben zu diesen Titeln zu finden, durchsucht ihr Yahoo Finance. Für die Aufgaben geben wir euch noch die folgenden Tipps:

  // - Net Income kann als Synonym von Reingewinn verstanden werden.
  // - Nutzt für alle Berechnungen den Stichtag 30.12.2022 und die Daten des jeweils aktuellsten Jahresabschlusses (2022), welchen ihr auf Yahoo Finance findet.
  // - Vernachlässigt Währungsunterschiede.
  // - Nutzt bei der relativen Bewertung jeweils die Multiples der zwei anderen Unternehmen, um den theoretischen Kurs eures Zielunternehmens zu bestimmen.
  // - Ihr könnt folgende Eigenkapitalkostensätze für eure Berechnungen verwenden: Novartis AG: 8.40%, Sanofi: 11.00%, Bristol-Myers: 9.60%.

  // `,
  //     scheduledStartAt: new Date('2023-03-24T11:00:00.000Z'),
  //     scheduledEndAt: new Date('2023-03-31T22:00:00.000Z'),
  //     parameters: {},
  //     clues: {
  //       connectOrCreate: [
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'method1',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'method1',
  //             displayName: 'Methode 1',
  //             value: 'Dividendendiskontierungsmodell',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'method2',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'method2',
  //             displayName: 'Methode 2',
  //             value: 'Dividendenwachstumsmodell',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'method3',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'method3',
  //             displayName: 'Methode 3',
  //             value: 'Gewinnmodell',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'method4',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'method4',
  //             displayName: 'Methode 4',
  //             value: 'P/E Multiple',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'method5',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'method5',
  //             displayName: 'Methode 5',
  //             value: 'EV/Sales Multiple',
  //           },
  //         },
  //       ],
  //     },
  //     instances: {
  //       connectOrCreate: await Promise.all(
  //         [745, 746, 747, 748, 749, 750, 751, 752].map(async (qId, ix) => {
  //           const question = await prisma.question.findUnique({
  //             where: { id: qId },
  //           })

  //           return {
  //             where: {
  //               type_groupActivityId_order: {
  //                 type: 'GROUP_ACTIVITY',
  //                 groupActivityId: GROUP_ACTIVITY_ID,
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
  //         id: USER_ID_BF2,
  //       },
  //     },
  //     course: {
  //       connect: {
  //         id: COURSE_ID_BF2,
  //       },
  //     },
  //   },
  //   update: {},
  // })

  // const GROUP_ACTIVITY_ID = '8cece48e-cc4c-4328-a120-345969a90abb'
  // const groupActivity3BF2 = await prisma.groupActivity.upsert({
  //   where: {
  //     id: GROUP_ACTIVITY_ID,
  //   },
  //   create: {
  //     id: GROUP_ACTIVITY_ID,
  //     name: 'BFII Gruppenquest 3',
  //     displayName: 'BFII Gruppenquest 3',
  //     description: `![](https://sos-ch-dk-2.exo.io/klicker-prod/img/bf2/bf2_group_activity_3.png)
  // Du und deine Kolleg:innen wollt mit geteiltem Portemonnaie ein Portfolio zusammenstellen. Sprecht euch untereinander ab, um herauszufinden, welche Aktientitel infrage kommen. Für die Besprechungen und Rechnungen geben wir euch die folgenden Tipps:

  // -	Verwendet die euch zur Verfügung gestellten Daten der letzten zehn Jahre für eure Berechnungen.
  // -	Ausgeschüttete Dividenden können für die Berechnungen vernachlässigt werden.
  // -	Nutzt passende Excel Übungen im Self-Learning auf OLAT, um die relevanten Parameter zu testen und deren Einfluss zu untersuchen.
  //   `,
  //     scheduledStartAt: new Date('2023-04-21T11:00:00.000Z'),
  //     scheduledEndAt: new Date('2023-04-28T22:00:00.000Z'),
  //     parameters: {},
  //     clues: {
  //       connectOrCreate: [
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'stock1',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'stock1',
  //             displayName: 'Aktie 1',
  //             value:
  //               '[Novartis](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/NovartisAktienkursAF8SF.xlsx)',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'stock2',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'stock2',
  //             displayName: 'Aktie 2',
  //             value:
  //               '[Sanofi](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/SanofiAktienkursA837H.xlsx)',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'stock3',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'stock3',
  //             displayName: 'Aktie 3',
  //             value:
  //               '[Bristol](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/BristolAktienkursK8FH3.xlsx)',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'stock4',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'stock4',
  //             displayName: 'Aktie 4',
  //             value:
  //               '[Pfizer](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/PfizerAktienkurs7FDK6.xlsx)',
  //           },
  //         },
  //         {
  //           where: {
  //             groupActivityId_name: {
  //               groupActivityId: GROUP_ACTIVITY_ID,
  //               name: 'stock5',
  //             },
  //           },
  //           create: {
  //             type: 'STRING',
  //             name: 'stock5',
  //             displayName: 'Aktie 5',
  //             value:
  //               '[Roche](https://sos-ch-dk-2.exo.io/klicker-prod/excel/bf2/RocheAktienkurs9KDH7.xlsx)',
  //           },
  //         },
  //       ],
  //     },
  //     instances: {
  //       connectOrCreate: await Promise.all(
  //         [775, 776, 777, 773, 774, 778, 779, 780, 781, 782, 784, 785].map(
  //           async (qId, ix) => {
  //             const question = await prisma.question.findUnique({
  //               where: { id: qId },
  //             })

  //             return {
  //               where: {
  //                 type_groupActivityId_order: {
  //                   type: 'GROUP_ACTIVITY',
  //                   groupActivityId: GROUP_ACTIVITY_ID,
  //                   order: ix,
  //                 },
  //               },
  //               create: prepareQuestionInstance({
  //                 question,
  //                 type: 'GROUP_ACTIVITY',
  //                 order: ix,
  //               }),
  //             }
  //           }
  //         )
  //       ),
  //     },
  //     owner: {
  //       connect: {
  //         id: USER_ID_BF2,
  //       },
  //     },
  //     course: {
  //       connect: {
  //         id: COURSE_ID_BF2,
  //       },
  //     },
  //   },
  //   update: {},
  // })

  // SELECT DISTINCT(p.id), p.username, gi.results
  // FROM "GroupActivityInstance" gi
  // JOIN "ParticipantGroup" pg ON gi."groupId" = pg.id
  // JOIN "_ParticipantToParticipantGroup" match ON pg.id = match."B"
  // JOIN "Participant" p ON match."A" = p.id
  // WHERE gi.decisions IS NOT NULL
  //     AND gi."groupActivityId" = '9f5850a4-f58d-4144-94d6-68adb3ab0466'

  // const TEAMGEIST = []

  // await prisma.$transaction(
  //   TEAMGEIST.map((participantId) =>
  //     // prisma.participantAchievementInstance.upsert({
  //     //   where: {
  //     //     participantId_achievementId: {
  //     //       participantId,
  //     //       achievementId: 9,
  //     //     },
  //     //   },
  //     //   create: {
  //     //     achievedCount: 1,
  //     //     achievedAt: new Date(),
  //     //     participant: {
  //     //       connect: {
  //     //         id: participantId,
  //     //       },
  //     //     },
  //     //     achievement: {
  //     //       connect: {
  //     //         id: 9,
  //     //       },
  //     //     },
  //     //   },
  //     //   update: {
  //     //     achievedAt: new Date(),
  //     //     achievedCount: {
  //     //       increment: 1,
  //     //     },
  //     //   },
  //     // })
  //     // prisma.participant.update({
  //     //   where: {
  //     //     id: participantId,
  //     //   },
  //     //   data: {
  //     //     xp: {
  //     //       increment: 250,
  //     //     },
  //     //   },
  //     // })
  //   )
  // )

  // const DREAMTEAM = [

  // ]

  // await prisma.$transaction(
  //   DREAMTEAM.map((participantId) =>
  //     // prisma.participant.update({
  //     //   where: {
  //     //     id: participantId,
  //     //   },
  //     //   data: {
  //     //     xp: {
  //     //       increment: 1000,
  //     //     },
  //     //   },
  //     // })
  //     // prisma.leaderboardEntry.update({
  //     //   where: {
  //     //     type_participantId_courseId: {
  //     //       type: 'COURSE',
  //     //       participantId,
  //     //       courseId: COURSE_ID_BF2,
  //     //     },
  //     //   },
  //     //   data: {
  //     //     score: {
  //     //       increment: 500,
  //     //     },
  //     //   },
  //     // })
  //     // prisma.participantAchievementInstance.upsert({
  //     //   where: {
  //     //     participantId_achievementId: {
  //     //       participantId,
  //     //       achievementId: 8,
  //     //     },
  //     //   },
  //     //   create: {
  //     //     achievedCount: 1,
  //     //     achievedAt: new Date(),
  //     //     participant: {
  //     //       connect: {
  //     //         id: participantId,
  //     //       },
  //     //     },
  //     //     achievement: {
  //     //       connect: {
  //     //         id: 8,
  //     //       },
  //     //     },
  //     //   },
  //     //   update: {
  //     //     achievedAt: new Date(),
  //     //     achievedCount: {
  //     //       increment: 1,
  //     //     },
  //     //   },
  //     // })
  //   )
  // )
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
