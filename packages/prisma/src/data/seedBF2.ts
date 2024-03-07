import Prisma from '../../dist'
import { COURSE_ID_TEST, USER_ID_TEST } from './constants'
import { prepareGroupActivityStack } from './helpers'

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

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

  // create questions
  const GC1Question1 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Schätzung',
      type: Prisma.ElementType.FREE_TEXT,
      content:
        'Wie schätzt ihr die Zinsentwicklung in den nächsten 12 Monaten ein? Begründet eure Antwort in wenigen Sätzen. Überlegt euch anschliessend, wie sich eure ge-schätzte Zinsentwicklung auf die jeweiligen Bonds auswirken.',
      options: {
        displayMode: 'LIST',
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        restrictions: { maxLength: 1000 },
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const GC1Question2 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Auswahl Bond',
      type: Prisma.ElementType.FREE_TEXT,
      content:
        'Vergleicht die euch zugeteilten Bonds und entscheidet euch für die eurer Meinung nach beste Anleihe. Welchen Bond wählt ihr für euer Portfolio? Begründet eure Auswahl kurz.',
      options: {
        displayMode: 'LIST',
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        restrictions: { maxLength: 1000 },
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const GC1Question3 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Berechnung Clean Price Absolut',
      type: Prisma.ElementType.NUMERICAL,
      content:
        "Berechnet den theoretischen Preis dieses Bonds mittels der Present Value-Formel per 08.03.2024, wobei die Restlaufzeit auf ganze Jahre aufgerundet werden soll. Bestimmt sowohl den Clean Price der Anleihe (absolut). Die Couponzahlung erfolgt jeweils zum Liberierungsdatum. Nimm an, dass der Nennwert stets 5'000 beträgt.",
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        unit: 'CHF',
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const GC1Question4 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Berechnung Clean Price Prozent',
      type: Prisma.ElementType.NUMERICAL,
      content:
        'Bestimmt mit den gleichen Angaben den Clean Price der Anleihe in Prozent des Nennwerts.',
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        unit: '%',
        restrictions: { max: 100, min: 0 },
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const GC1Question5 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Berechnung Dirty Price Absolut',
      type: Prisma.ElementType.NUMERICAL,
      content:
        'Bestimmt mit den gleichen Angaben den absoluten Dirty Price der Anleihe.',
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        unit: 'CHF',
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const GC1Question6 = await prisma.element.create({
    data: {
      name: 'Gruppenquest 1: Berechnung Dirty Price Prozent',
      type: Prisma.ElementType.NUMERICAL,
      content:
        'Bestimmt mit den gleichen Angaben den Dirty Price der Anleihe in Prozent des Nennwerts.',
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        unit: '%',
        restrictions: { max: 100, min: 0 },
      },
      pointsMultiplier: 1,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: USER_ID_TEST,
            name: 'BF2 GA 1 (2024)',
          },
        },
      },
    },
  })

  const groupActivityId1 = '42c55042-d470-433a-bc7e-c98a2bfaf599'
  const groupActivity1 = await prisma.groupActivity.upsert({
    where: {
      id: groupActivityId1,
    },
    create: {
      id: groupActivityId1,
      name: 'Gruppenquest 1: Bonds',
      displayName: 'Gruppenquest 1: Bonds',
      description: `Du und deine Kollegen und Kolleginnen bonden oft über Bonds. Auch heute seid ihr zusammengekommen, um aktuelle Anleihen zu untersuchen und einen Bond zu wählen, den ihr kaufen werdet. Zur Auswahl stehen die euch zugeteilten Anlei-hen. Um genauere Angaben zu den Bonds zu finden, durchsucht ihr die Marktdaten der SIX [SIX Bond-Explorer](https://www.six-group.com/de/products-services/the-swiss-stock-exchange/market-data/bonds/bond-explorer.html)

Für die Aufgaben geben wir euch noch die folgenden Tipps: 
1. Das Rating der jeweiligen Anleihen sollte ein wichtiger Indikator für eure Entscheidung sein. 
2. Rundet die Restlaufzeit auf ganze Jahre auf (Bspw. 6.12 Jahre wird zu 7 Jahre)
3. Die Couponzahlung findet zum Lieberungsdatum statt. 
4. Gehe davon aus, dass ein Jahr 365 Tage hat.
5. Nimm an, dass der Nennwert stets 5'000 beträgt.

![](https://klickeruzhprodimages.blob.core.windows.net/2c26825d-84e0-4599-878c-3e0605e8180c/4d1f495b-fb1f-42de-b6b9-49afce587f77.png)`,
      status: Prisma.GroupActivityStatus.PUBLISHED,
      scheduledStartAt: new Date('2024-03-08T13:00:00.000Z'),
      scheduledEndAt: new Date('2024-03-15T23:00:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond1',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond1',
              displayName: 'Firma 1',
              value: 'CH0031835561 (Schweizer Eidgenossenschaft)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond2',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond2',
              displayName: 'Firma 2',
              value: 'CH0506071221 (ZKB)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond3',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond3',
              displayName: 'Firma 3',
              value: 'CH0270190991 (Novartis)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond4',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond4',
              displayName: 'Firma 4',
              value: 'CH0564642079 (Lindt & Sprüngli)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond5',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond5',
              displayName: 'Firma 5',
              value: 'CH1214797198 (ABB)',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: groupActivityId1,
                name: 'bond6',
              },
            },
            create: {
              type: Prisma.ParameterType.STRING,
              name: 'bond6',
              displayName: 'Firma 6',
              value: 'CH0271171693 (Apple)',
            },
          },
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            questions: [
              GC1Question1,
              GC1Question2,
              GC1Question3,
              GC1Question4,
              GC1Question5,
              GC1Question6,
            ] as Prisma.Element[],
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
