import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import { createHash } from 'node:crypto'

// ? This script fixes question responses of free text and numerical questions,
// ? which are currently inconsistent due to a errorneous aggergation logic

async function run() {
  const prisma = new PrismaClient()
  let counter = 0

  const instances = await prisma.elementInstance.findMany({
    include: {
      responses: true,
      detailResponses: true,
      element: true,
    },
    where: {
      OR: [
        {
          elementType: ElementType.FREE_TEXT,
        },
        {
          elementType: ElementType.NUMERICAL,
        },
      ],
    },
  })

  for (const instance of instances) {
    const responses = instance.responses
    const details = instance.detailResponses
    let responseUpdates: any[] = []

    for (const response of responses) {
      const aggregatedResponses = details
        .filter((detail) => detail.participantId === response.participantId)
        .reduce(
          (acc, detail) => {
            const value = detail.response.value as string

            const MD5 = createHash('md5')
            MD5.update(value)
            const hashedValue = MD5.digest('hex')
            const correctness =
              response.aggregatedResponses.responses[hashedValue].correct

            if (Object.keys(acc.responses).includes(hashedValue)) {
              acc.responses[hashedValue].count++
            } else {
              const newValue =
                instance.elementType === ElementType.NUMERICAL
                  ? String(parseFloat(value))
                  : value

              acc.responses[hashedValue] =
                typeof correctness !== 'undefined'
                  ? {
                      value: newValue,
                      count: 1,
                      correct: correctness,
                    }
                  : { value: newValue, count: 1 }
            }

            acc.total++
            return acc
          },
          { total: 0, responses: {} }
        )

      if (response.aggregatedResponses.total > 10) {
        console.log('OLD Aggregated Responses:', response.aggregatedResponses)
        console.log('NEW Aggregated Responses:', aggregatedResponses)
      }

      // ! Uncomment to apply migration
      // await prisma.questionResponse.update({
      //   where: {
      //     id: response.id,
      //   },
      //   data: {
      //     aggregatedResponses,
      //   },
      // })
    }

    counter++
    console.log('Processed element', counter, '/', instances.length)
  }
}

await run()
