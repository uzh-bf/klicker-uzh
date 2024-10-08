import * as R from 'ramda'
import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const elementInstances = await prisma.elementInstance.findMany({})

  console.log('elementInstances', elementInstances.length)

  let counter = 0

  for (let elem of elementInstances) {
    counter++

    if (typeof elem.elementData.id === 'number') {
      console.log('elementData.id', elem.elementData.id)

      elem = await prisma.elementInstance.update({
        where: {
          id: elem.id,
        },
        data: {
          elementData: {
            ...elem.elementData,
            id: `${elem.elementData.id}-v1`,
            elementId: elem.elementData.id,
          },
        },
      })
    }

    if (typeof elem.elementData.elementId === 'undefined') {
      console.log('elementData.elementId', elem.elementData.elementId)

      if (typeof elem.elementData.questionId === 'undefined') {
        console.log('elementData.questionId', elem.elementData.questionId)
        throw new Error(
          `elementData.questionId is undefined for ElementInstance ${elem.id}`
        )
      }

      elem = await prisma.elementInstance.update({
        where: {
          id: elem.id,
        },
        data: {
          elementData: {
            ...elem.elementData,
            elementId: elem.elementData.questionId,
          },
        },
      })
    }

    if (typeof elem.elementData.questionId !== 'undefined') {
      console.log('elementData.questionId', elem.elementData.questionId)

      await prisma.elementInstance.update({
        where: {
          id: elem.id,
        },
        data: {
          elementData: R.omit(['questionId'], elem.elementData),
        },
      })
    }
  }

  console.log(counter)
}

await migrate()
