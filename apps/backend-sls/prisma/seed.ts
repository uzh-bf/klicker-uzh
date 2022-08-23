import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'

async function main(prisma: Prisma.PrismaClient) {
  const user = await prisma.user.upsert({
    where: {
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
    },
    create: {
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
      email: 'roland.schlaefli@bf.uzh.ch',
      password: 'abcd',
      shortname: 'rschlaefli',
    },
    update: {},
  })

  const course = await prisma.course.upsert({
    where: {
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
    },
    create: {
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
      name: 'Banking and Finance I',
      displayName: 'Banking and Finance I',
      ownerId: user.id,
    },
    update: {},
  })

  const question = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33a',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33a',
      name: 'Zieldreieck',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            feedback:
              'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
            correct: false,
            value:
              'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
          },
          {
            feedback:
              'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
            correct: true,
            value:
              'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
          },
          {
            feedback:
              'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
            correct: false,
            value:
              'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
          },
          {
            feedback:
              'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
            correct: false,
            value:
              'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
          },
          {
            feedback:
              'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
            correct: false,
            value:
              'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question2 = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33b',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33b',
      name: 'Organisation des Finanzwesens',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Die zentralen Tätigkeiten einer Finanzabteilung lassen sich in Finanzplanung, Finanzdisposition (d.h. die Realisierung der Finanzplanung) und Finanzcontrolling einteilen.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Beim Controlling geht es grundsätzlich um die Überwachung des finanziellen Geschehens. Dies wird mit Hilfe eines Soll/Ist-Vergleichs der Finanzplanung gemacht.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'In grossen Firmen gibt es normalerweise neben dem CFO jeweils einen Controller und einen Treasurer.',
          },
          {
            feedback:
              'Diese Aussage ist korrekt! Die Kapitalbeschaffung ist Aufgabe des Treasurers.',
            correct: true,
            value:
              'Der Controller ist unter anderem für die Regelung der Ausgabe von Wertpapieren verantwortlich.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Der Treasurer kümmert sich um das ganze Cash- und Credit-Management.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const instance = await prisma.questionInstance.upsert({
    where: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781e',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781e',
      questionData: {
        ...question,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance2 = await prisma.questionInstance.upsert({
    where: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781f',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781f',
      questionData: {
        ...question2,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question2.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const learningElement = await prisma.learningElement.upsert({
    where: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    },
    create: {
      courseId: course.id,
      ownerId: user.id,
      instances: {
        connect: [
          {
            id: instance.id,
          },
          {
            id: instance2.id,
          },
        ],
      },
    },
    update: {
      instances: {
        connect: [
          {
            id: instance.id,
          },
          {
            id: instance2.id,
          },
        ],
      },
    },
  })
}

const prismaClient = new Prisma.PrismaClient()

main(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
