import { ElementType, PrismaClient } from '@klicker-uzh/prisma'

async function run() {
  const prisma = new PrismaClient()

  const numChoicesQuestions = await prisma.elementInstance.count({
    where: {
      elementType: {
        in: [ElementType.SC, ElementType.MC, ElementType.KPRIM],
      },
    },
  })

  const batchSize = 100
  let batchCounter = 0
  let counter = 0
  let missingIxElementData = 0
  let invalidInstanceIds: number[] = []

  while (true) {
    const choicesInstances = await prisma.elementInstance.findMany({
      where: {
        elementType: {
          in: [ElementType.SC, ElementType.MC, ElementType.KPRIM],
        },
      },
      skip: batchCounter * batchSize,
      take: batchSize,
    })

    if (choicesInstances.length === 0) {
      break
    }

    for (const instance of choicesInstances) {
      const options = instance.elementData.options

      if (!('choices' in options)) {
        throw new Error('Expected choices element data')
      }

      const ixs = options.choices.map((choice) => choice.ix)
      if (ixs.some((ix) => ix >= options.choices.length)) {
        missingIxElementData++
        invalidInstanceIds.push(instance.id)
        console.log('Invalid instance', instance.id)
        console.log('Invalid choices', options.choices)
      }
    }

    batchCounter++
  }

  console.log('Number of invalid instances:', missingIxElementData)
  console.log('Invalid instance IDs:', invalidInstanceIds)

  return
}

await run()
