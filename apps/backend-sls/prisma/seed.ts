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
      results: {},
      questionId: question.id,
      ownerId: user.id,
    },
    update: {},
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
        ],
      },
    },
    update: {},
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
