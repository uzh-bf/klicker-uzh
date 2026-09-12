import { prisma } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma/client'
import { CaseStudyElementData, SelectionElementData } from '@klicker-uzh/types'

async function run() {
  // fetch all activity templates and the linked answer collections
  const templates = await prisma.activityTemplate.findMany({
    include: {
      answerCollections: true,
      liveQuiz: {
        include: {
          blocks: {
            include: {
              elements: true,
            },
          },
        },
      },
    },
  })

  // iterate over all templates and compare the linked answer collections to the ones contained in its instances
  for (const template of templates) {
    const liveQuiz = template.liveQuiz

    if (!liveQuiz) {
      throw new Error(`Template ${template.id} does not have a live quiz`)
    }

    const templateCollectionIds = template.answerCollections.map(
      (collection) => collection.id
    )
    const instances = liveQuiz.blocks.flatMap((block) => block.elements)
    const instanceCollectionIds = Array.from(
      new Set(
        instances
          .filter(
            (instance) =>
              instance.elementType === ElementType.SELECTION ||
              instance.elementType === ElementType.CASE_STUDY
          )
          .map((instance) =>
            instance.elementType === ElementType.SELECTION
              ? (instance.elementData as SelectionElementData).options
                  .answerCollection!.id
              : (instance.elementData as CaseStudyElementData).options
                  .answerCollectionId!
          )
      )
    )

    // log the template and instance answer collection ids
    console.log('Template answer collection ids:', templateCollectionIds)
    console.log('Instance answer collection ids:', instanceCollectionIds)

    // check if these arrays contain the same elements and have same length, otherwise throw an error
    if (
      templateCollectionIds.length !== instanceCollectionIds.length ||
      !templateCollectionIds.every((id) => instanceCollectionIds.includes(id))
    ) {
      throw new Error(
        `Template ${template.id} has different answer collections in its instances`
      )
    }
  }
}

await run()
