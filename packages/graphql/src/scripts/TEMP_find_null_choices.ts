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
  let invalidChoicesInstanceCounter = 0
  let invalidChoicesResponseCounter = 0
  let instancesWithInvalidResponses: number[] = []

  while (true) {
    const choicesInstances = await prisma.elementInstance.findMany({
      where: {
        elementType: {
          in: [ElementType.SC, ElementType.MC, ElementType.KPRIM],
        },
      },
      include: {
        responses: true,
      },
      skip: batchCounter * batchSize,
      take: batchSize,
    })

    if (choicesInstances.length === 0) {
      break
    }

    for (const instance of choicesInstances) {
      counter++
      console.log('Processing instance', counter, 'out of', numChoicesQuestions)

      if (!('choices' in instance.results)) {
        throw new Error('Expected ChoiceResults')
      }

      // ! CHECK NULL VALUES IN CHOICES ON ELEMENT INSTANCES
      // #region
      let nullChoice = false
      const choices = instance.results.choices

      Object.values(choices).some((choice) => {
        if (choice === null) {
          nullChoice = true
        }
      })

      if (nullChoice) {
        invalidChoicesInstanceCounter++
        console.log(
          'Invalid instance results with instance id',
          instance.id,
          choices
        )
      }
      // #endregion

      // ! CHECK IF AGGREGATED RESPONSES CONTAIN NULL VALUES IN CHOICES
      // #region
      for (const response of instance.responses) {
        if (!('choices' in response.aggregatedResponses)) {
          throw new Error(
            "Expected 'chocies' on question response to choices question"
          )
        }

        let nullChoiceResponse = false
        const choices = response.aggregatedResponses.choices
        Object.values(choices).some((choice) => {
          if (choice === null) {
            nullChoiceResponse = true
          }
        })

        if (nullChoiceResponse) {
          invalidChoicesResponseCounter++

          console.log(
            'Invalid response with response id',
            response.id,
            'on element instance',
            instance.id,
            'aggregated response choices:',
            choices
          )

          if (!instancesWithInvalidResponses.includes(instance.id)) {
            instancesWithInvalidResponses.push(instance.id)
          }
        }
      }
    }

    batchCounter++
  }

  console.log('FOUND', invalidChoicesInstanceCounter, 'INVALID INSTANCES')
  console.log('FOUND', invalidChoicesResponseCounter, 'INVALID RESPONSES')
  console.log('INSTANCES WITH INVALID RESPONSES', instancesWithInvalidResponses)

  return
}

await run()
