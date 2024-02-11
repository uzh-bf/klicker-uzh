import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const questionResponses = await prisma.questionResponse.findMany({
    where: {
      questionInstanceId: {
        not: null,
      },
      elementInstanceId: {
        equals: null,
      },
    },
    include: {
      questionInstance: true,
    },
  })

  let counter = 1
  let counter2 = 1

  for (const elem of questionResponses) {
    if (typeof elem.questionInstanceId !== 'number') {
      continue
    }

    const matchingElementInstance = await prisma.elementInstance.findFirst({
      where: {
        migrationId: String(elem.questionInstanceId),
      },
    })

    if (!matchingElementInstance) {
      continue
    }

    const matchingQuestionResponse = await prisma.questionResponse.findFirst({
      where: {
        elementInstanceId: matchingElementInstance?.id,
      },
      include: {
        participant: true,
      },
    })

    if (matchingQuestionResponse) {
      // there is already a question response for this element instance but not the current one
      counter2++
      continue
    }

    console.log(counter, elem.id, elem)

    try {
      await prisma.questionResponse.update({
        where: { id: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })
    } catch (e) {
      console.error(e)
    }

    counter++
  }

  console.log(counter, counter2)

  const questionResponsesDetail = await prisma.questionResponseDetail.findMany({
    where: {
      questionInstanceId: {
        not: null,
      },
      elementInstanceId: {
        equals: null,
      },
    },
    include: {
      questionInstance: true,
    },
  })

  counter = 1
  counter2 = 1

  for (const elem of questionResponsesDetail) {
    if (typeof elem.questionInstanceId !== 'number') {
      continue
    }

    const matchingElementInstance = await prisma.elementInstance.findFirst({
      where: {
        migrationId: String(elem.questionInstanceId),
      },
    })

    if (!matchingElementInstance) {
      continue
    }

    const matchingQuestionResponse =
      await prisma.questionResponseDetail.findFirst({
        where: {
          elementInstanceId: matchingElementInstance?.id,
        },
        include: {
          participant: true,
        },
      })

    if (matchingQuestionResponse) {
      // there is already a question response for this element instance but not the current one
      counter2++
      continue
    }

    console.log(counter, elem.id, elem)

    try {
      await prisma.questionResponseDetail.update({
        where: { id: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })
    } catch (e) {
      console.error(e)
    }

    counter++
  }

  console.log(counter, counter2)
}

await migrate()
