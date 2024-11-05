import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import { createHash } from 'node:crypto'

async function run() {
  const prisma = new PrismaClient()

  let promises: any[] = []

  const instances = await prisma.elementInstance.findMany({
    include: {
      detailResponses: true,
      element: true,
    },
    where: {
      elementType: ElementType.NUMERICAL,
    },
  })

  for (const instance of instances) {
    const instanceResults = instance.results
    let newResults = {
      responses: {},
      total: 0,
    }

    instance.detailResponses.forEach((entry) => {
      const { value } = entry.response as { value: string }
      const MD5 = createHash('md5')
      MD5.update(String(value))
      const hashedValue = MD5.digest('hex')

      if (Object.keys(newResults.responses).includes(hashedValue)) {
        newResults.responses[hashedValue].count++
      } else {
        if (!Object.keys(instanceResults.responses).includes(hashedValue)) {
          console.log(instanceResults)
          console.log('Value:', value)
          console.log('Hashed value:', hashedValue)
          throw new Error('Value not found in original results')
        }

        const correctness = instanceResults.responses[hashedValue].correct
        newResults.responses[hashedValue] =
          typeof correctness !== 'undefined'
            ? {
                count: 1,
                correct: instanceResults.responses[hashedValue].correct,
                value: String(parseFloat(value)),
              }
            : {
                count: 1,
                value: String(parseFloat(value)),
              }
      }

      newResults.total++
    })

    console.log('OLD RESULTS', instance.results)
    console.log('NEW RESULTS', newResults)

    // ! Uncomment this to apply the changes to the database
    await prisma.elementInstance.update({
      where: {
        id: instance.id,
      },
      data: {
        results: newResults,
      },
    })
  }
}

await run()
