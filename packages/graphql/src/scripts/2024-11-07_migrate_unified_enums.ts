import { prisma } from '@klicker-uzh/prisma'
import {
  ElementStackType,
  ElementStackTypeNew,
  GroupActivityStatus,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'

// ? This script will migrate the old group activity status and element
// ? stack types to the new unified enums (old values persist for now)

async function run() {
  // element stack type to new column
  const elementStacks = await prisma.elementStack.findMany()
  for (const elementStack of elementStacks) {
    const oldType = elementStack.type
    let newType: ElementStackTypeNew | undefined

    switch (oldType) {
      case ElementStackType.GROUP_ACTIVITY:
        newType = ElementStackTypeNew.GROUP_ACTIVITY
        break
      case ElementStackType.MICROLEARNING:
        newType = ElementStackTypeNew.MICROLEARNING
        break
      case ElementStackType.PRACTICE_QUIZ:
        newType = ElementStackTypeNew.PRACTICE_QUIZ
        break
      default:
        break
    }

    console.log('processing stack ', elementStack.id)

    await prisma.elementStack.update({
      where: { id: elementStack.id },
      data: { typeNEW: newType },
    })
  }

  // group activity status to new column
  const groupActivities = await prisma.groupActivity.findMany()
  for (const groupActivity of groupActivities) {
    const oldType = groupActivity.status
    let newType: PublicationStatus = PublicationStatus.DRAFT

    switch (oldType) {
      case GroupActivityStatus.DRAFT:
        newType = PublicationStatus.DRAFT
        break
      case GroupActivityStatus.SCHEDULED:
        newType = PublicationStatus.SCHEDULED
        break
      case GroupActivityStatus.PUBLISHED:
        newType = PublicationStatus.PUBLISHED
        break
      case GroupActivityStatus.ENDED:
        newType = PublicationStatus.ENDED
        break
      case GroupActivityStatus.GRADED:
        newType = PublicationStatus.GRADED
        break
      default:
        break
    }

    console.log('processing group activity ', groupActivity.id)

    await prisma.groupActivity.update({
      where: { id: groupActivity.id },
      data: { statusNEW: newType },
    })
  }
}

await run()
