import Prisma from '../../dist'
import { prepareGroupActivityStack } from './helpers'
// import { USER_ID_TEST } from './constants'

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  const USER_ID_TEST = '2c26825d-84e0-4599-878c-3e0605e8180c'
  const COURSE_ID_TEST = '1caf787f-98c1-4de4-8ef6-bd428ac550f3'

  // upsert tag
  const tag = await prisma.tag.upsert({
    where: {
      ownerId_name: {
        ownerId: USER_ID_TEST,
        name: 'BF2 GA 1 (2024)',
      },
    },
    update: {},
    create: {
      name: 'BF2 GA 1 (2024)',
      ownerId: USER_ID_TEST,
    },
  })

  const tag2 = await prisma.tag.upsert({
    where: {
      ownerId_name: {
        ownerId: USER_ID_TEST,
        name: 'BF2 GA 2 (2024)',
      },
    },
    update: {},
    create: {
      name: 'BF2 GA 2 (2024)',
      ownerId: USER_ID_TEST,
    },
  })

  // create questions
  // const GC1Question1 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Schätzung',
  //     type: Prisma.ElementType.FREE_TEXT,
  //     content:
  //       'Wie schätzt ihr die Zinsentwicklung in den nächsten 12 Monaten ein? Begründet eure Antwort in wenigen Sätzen. Überlegt euch anschliessend, wie sich eure ge-schätzte Zinsentwicklung auf die jeweiligen Bonds auswirken.',
  //     options: {
  //       displayMode: 'LIST',
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       restrictions: { maxLength: 1000 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // const GC1Question2 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Auswahl Bond',
  //     type: Prisma.ElementType.FREE_TEXT,
  //     content:
  //       'Vergleicht die euch zugeteilten Bonds und entscheidet euch für die eurer Meinung nach beste Anleihe. Welchen Bond wählt ihr für euer Portfolio? Begründet eure Auswahl kurz.',
  //     options: {
  //       displayMode: 'LIST',
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       restrictions: { maxLength: 1000 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // const GC1Question3 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Berechnung Clean Price Absolut',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       "Berechnet den theoretischen Preis dieses Bonds mittels der Present Value-Formel per 08.03.2024, wobei die Restlaufzeit auf ganze Jahre aufgerundet werden soll. Bestimmt sowohl den Clean Price der Anleihe (absolut). Die Couponzahlung erfolgt jeweils zum Liberierungsdatum. Nimm an, dass der Nennwert stets 5'000 beträgt.",
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       unit: 'CHF',
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // const GC1Question4 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Berechnung Clean Price Prozent',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Bestimmt mit den gleichen Angaben den Clean Price der Anleihe in Prozent des Nennwerts.',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       unit: '%',
  //       restrictions: { max: 100, min: 0 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // const GC1Question5 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Berechnung Dirty Price Absolut',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Bestimmt mit den gleichen Angaben den absoluten Dirty Price der Anleihe.',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       unit: 'CHF',
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // const GC1Question6 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 1: Berechnung Dirty Price Prozent',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Bestimmt mit den gleichen Angaben den Dirty Price der Anleihe in Prozent des Nennwerts.',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       unit: '%',
  //       restrictions: { max: 100, min: 0 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 1 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // // SC question
  // const GC1Question7 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Unterschiede Bewertungsmethoden',
  //     type: Prisma.ElementType.SC,
  //     content:
  //       'Jedes Teammitglied berechnet den theoretischen Aktienpreis des ihm/ihr zu-gewiesenen Unternehmen anhand der vier Bewertungsmethoden (DDM, DGM; Gewinnmodell; P/E-Multiple). Achtet auf die gegebenen Tipps. Vergleicht eure Ergebnisse mit dem momentanen Aktienkurs und diskutiert diese. Welche der drei Aktien werdet ihr kaufen?',
  //     options: {
  //       displayMode: 'LIST',
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       choices: [
  //         {
  //           ix: 0,
  //           value: 'Nestlé',
  //         },
  //         {
  //           ix: 1,
  //           value: 'Danone',
  //         },
  //         {
  //           ix: 2,
  //           value: 'Unilever',
  //         },
  //       ],
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // // FT Question
  // const GC1Question8 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Auswahl Unternehmen',
  //     type: Prisma.ElementType.FREE_TEXT,
  //     content:
  //       'Erklärt in einigen Sätzen, weshalb ihr euch für diese Aktie entschieden habt. Berücksichtigt auch die jeweiligen ESG-Ratings der Unternehmen und erklärt, inwiefern diese eure Entscheidung beeinflusst haben.',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       restrictions: { maxLength: 1500 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })
  // const GC1Question9 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Unterschiede Bewertungsmethoden',
  //     type: Prisma.ElementType.FREE_TEXT,
  //     content:
  //       'Vergleicht die erhaltenen Resultate und besprecht auffällige Unterschiede zwischen den Bewertungsmethoden. Versucht zu erklären, woher die Unterschiede stammen.',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       restrictions: { maxLength: 1500 },
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  // // 4x numerical question
  // const GC1Question10 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Wert Dividendendiskontierungsmodell (DDM)',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Welchen Wert habt ihr für den gewählten Aktientitel gemäss dem Dividendendiskontierungsmodell (DDM) erhalten? Bitte eine Zahl eingeben (gerundet auf zwei Nachkommastellen).',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       accuracy: 2,
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })
  // const GC1Question11 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Wert Dividendenwachstumsmodell (DGM)',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Welchen Wert habt ihr für den gewählten Aktientitel gemäss dem Dividendenwachstumsmodell (DGM) erhalten? Bitte eine Zahl eingeben (gerundet auf zwei Nachkommastellen).',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       accuracy: 2,
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })
  // const GC1Question12 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Wert Gewinnmodell',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Welchen Wert habt ihr für den gewählten Aktientitel gemäss dem Gewinnmodell erhalten? Bitte eine Zahl eingeben (gerundet auf zwei Nachkommastellen).',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       accuracy: 2,
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })
  // const GC1Question13 = await prisma.element.create({
  //   data: {
  //     name: 'Gruppenquest 2: Wert Price Earning Multiple',
  //     type: Prisma.ElementType.NUMERICAL,
  //     content:
  //       'Welchen Wert habt ihr für den gewählten Aktientitel für das Price Earning Multiple erhalten? Bitte eine Zahl eingeben (gerundet auf zwei Nachkommastellen).',
  //     options: {
  //       hasSampleSolution: false,
  //       hasAnswerFeedbacks: false,
  //       accuracy: 2,
  //     },
  //     pointsMultiplier: 1,
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     tags: {
  //       connect: {
  //         ownerId_name: {
  //           ownerId: USER_ID_TEST,
  //           name: 'BF2 GA 2 (2024)',
  //         },
  //       },
  //     },
  //   },
  // })

  const questionsGC2 = await prisma.element.findMany({
    where: {
      tags: {
        some: {
          name: 'BF2 GA 2 (2024)',
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const groupActivityId2 = '3797cc0b-e523-4993-bc0e-261c380abc1d'
  const groupActivity2 = await prisma.groupActivity.upsert({
    where: {
      id: groupActivityId2,
    },
    create: {
      id: groupActivityId2,
      name: 'Gruppenquest 2: Aktien(bewertung)',
      displayName: 'Gruppenquest 2: Aktien(bewertung)',
      description: `Du und deine Kollegen und Kolleginnen sharen euer Wissen über Shares. Auch heute seid ihr zusammengekommen, um aktuelle Aktien zu analysieren und eine auszuwählen, welche ihr kaufen werdet. Zur Auswahl stehen die folgenden Aktientitel der Konsum- und Lebensmittelindustrie:

  -	Nestlé (CH0038863350)
  -	Danone (FR0000120644)
  -	Unilever (GB00B10RZP78)

  Um genauere Angaben zu diesen Titeln zu finden, durchsucht ihr [Boerse.de](https://www.boerse.de/). Für die Aufgaben geben wir euch noch die folgenden Tipps:
  -	Nutzt für alle Berechnungen den Stichtag 29.12.2023 und die Daten des jeweils aktuellsten Jahresabschlusses (2023), welchen ihr auf Boerse.de findet.
  -	Benutzt für die Berechnungen den Schluss-Aktienkurs per 29.12.2023.
  -	Nehmt an, dass die Dividende per 2023 der Dividende D0 entspricht.
  -	Vernachlässigt Währungsunterschiede.
  -	Falls die Daten für 2023 nicht zur Verfügung stehen, nehmt die Daten für die Vorjahre.
  -	Nutzt bei der relativen Bewertung (P/E-Multiple) jeweils den Durchschnitt der Multiples der zwei anderen Unternehmen, um den theoretischen Kurs eures Zielunternehmens zu bestimmen. Berechnet hierzu die P/E-Multiples selbst und benutzt nicht die angegebenen Werte.
  -	Als Hinweise erhaltet ihr die folgenden Eigenkapitalkostensätze und Wachstumsraten:

  ![](https://klickeruzhprodimages.blob.core.windows.net/2c26825d-84e0-4599-878c-3e0605e8180c/08d64639-6305-46cd-87b8-d3708eebc1b4.png)`,
      status: Prisma.GroupActivityStatus.PUBLISHED,
      scheduledStartAt: new Date('2024-03-22T13:00:00.000Z'),
      scheduledEndAt: new Date('2024-03-29T22:59:59.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'nestle_kek',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'nestle_kek',
              displayName: 'Nestlé k_ek',
              value: '7.00',
              unit: '%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'danone_kek',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'danone_kek',
              displayName: 'Danone k_ek',
              value: '8.50',
              unit: '%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'unilever_kek',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'unilever_kek',
              displayName: 'Unilever k_ek',
              value: '10.50',
              unit: '%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'nestle_wachstum',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'nestle_wachstum',
              displayName: 'Nestlé Wachstumsrate g',
              value: '1.00',
              unit: '%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'danone_wachstum',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'danone_wachstum',
              displayName: 'Danone Wachstumsrate g',
              value: '0.75',
              unit: '%',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId2,
                name: 'unilever_wachstum',
              },
            },
            create: {
              type: Prisma.ParameterType.NUMBER,
              name: 'unilever_wachstum',
              displayName: 'Unilever Wachstumsrate k_ek',
              value: '2.50',
              unit: '%',
            },
          },
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            questions: questionsGC2,
            courseId: COURSE_ID_TEST,
            connectStackToCourse: false,
          }),
        },
      },
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_TEST,
        },
      },
    },
    update: {},
  })
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
