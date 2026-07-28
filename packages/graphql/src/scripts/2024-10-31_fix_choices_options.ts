import { prisma } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma/client'

interface Choice {
  ix: number
  [key: string]: any
}

interface ValidationResult {
  hasValidIndices: boolean
  hasDuplicateIndices: boolean
  hasGaps: boolean
  needsReordering: boolean
}

function validateChoices(
  choices: Choice[],
  entityType: string,
  entityId: number,
  verbose: boolean
): ValidationResult {
  const hasValidIndices = choices.every((c) => typeof c.ix === 'number')
  const hasDuplicateIndices =
    new Set(choices.map((c) => c.ix)).size !== choices.length
  const hasGaps = !choices.every((_, index) =>
    choices.some((c) => c.ix === index)
  )
  const needsReordering = choices.some((c, index) => c.ix !== index)

  if ((verbose && !hasValidIndices) || hasDuplicateIndices || hasGaps) {
    console.error(
      `${entityType} ${entityId} has invalid choices configuration:`
    )
    if (!hasValidIndices) console.error(' - Some indices are not numbers')
    if (hasDuplicateIndices) console.error(' - Contains duplicate indices')
    if (hasGaps) console.error(' - Has gaps in index sequence')
    console.error('Choices:', choices)
  }

  return { hasValidIndices, hasDuplicateIndices, hasGaps, needsReordering }
}

async function run() {
  const verbose = true

  // ! VALIDATION
  // fetch all elements
  const es = await prisma.element.findMany()

  // fetch all element instances
  const eis = await prisma.elementInstance.findMany({
    include: { responses: true, detailResponses: true },
  })

  // fetch all question instances
  const qis = await prisma.questionInstance.findMany()

  // loop over all elements, filter for choices questions and check if choices are in order
  let e_errors = 0
  let e_updates = 0
  for (const e of es) {
    if (
      e.type === ElementType.SC ||
      e.type === ElementType.MC ||
      e.type === ElementType.KPRIM
    ) {
      const choices = e.options.choices
      const { needsReordering } = validateChoices(
        choices,
        'Element',
        e.id,
        verbose
      )

      if (needsReordering) {
        e_errors += 1

        if (verbose) {
          console.error(
            `Element ${e.id} has choices out of order: ${choices
              .map((c) => c.ix)
              .join(', ')}`
          )
        }

        // update the element choices
        const newChoices = choices.map((c, index) => ({
          ...c,
          ix: index,
        }))

        console.log('OLD CHOICES:')
        console.log(choices)
        console.log('NEW CHOICES:')
        console.log(newChoices)
        e_updates += 1

        // TODO: uncomment to trigger element updates
        // await prisma.element.update({
        //   where: { id: e.id },
        //   data: {
        //     options: {
        //       ...e.options,
        //       choices: newChoices,
        //     },
        //   },
        // })
      }
    }
  }

  // loop over all element instances, filter for choices instances, check if choices are in order
  let ei_errors = 0
  let ei_updates = 0
  for (const ei of eis) {
    if (
      ei.elementType === ElementType.SC ||
      ei.elementType === ElementType.MC ||
      ei.elementType === ElementType.KPRIM
    ) {
      const choices = ei.elementData.options.choices
      const { needsReordering } = validateChoices(
        choices,
        'ElementInstance',
        ei.id,
        verbose
      )

      if (needsReordering) {
        ei_errors += 1

        if (verbose) {
          console.error(
            `ElementInstance ${ei.id} has choices out of order: ${choices
              .map((c) => c.ix)
              .join(
                ', '
              )} with ${ei.responses.length} responses and ${ei.detailResponses.length} detail responses`
          )
        }

        // update the indices on the element instances
        const newChoices = choices.map((c, index) => ({
          ...c,
          ix: index,
        }))

        console.log('OLD CHOICES:')
        console.log(choices)
        console.log('NEW CHOICES:')
        console.log(newChoices)
        ei_updates += 1

        // TODO: uncomment to trigger element instance updates
        // await prisma.elementInstance.update({
        //   where: { id: ei.id },
        //   data: {
        //     elementData: {
        //       ...ei.elementData,
        //       options: {
        //         ...ei.elementData.options,
        //         choices: newChoices,
        //       },
        //     },
        //   },
        // })
      }
    }
  }

  let qi_errors = 0
  let qi_updates = 0
  for (const qi of qis) {
    if (
      qi.questionData.type === ElementType.SC ||
      qi.questionData.type === ElementType.MC ||
      qi.questionData.type === ElementType.KPRIM
    ) {
      const choices = qi.questionData.options.choices
      const { needsReordering } = validateChoices(
        choices,
        'QuestionInstance',
        qi.id,
        verbose
      )

      if (needsReordering) {
        qi_errors += 1

        if (verbose) {
          console.error(
            `QuestionInstance ${qi.id} has choices out of order: ${choices
              .map((c) => c.ix)
              .join(', ')}`
          )
        }

        // update the indices on the question instances
        const newChoices = choices.map((c, index) => ({
          ...c,
          ix: index,
        }))

        console.log('OLD CHOICES:')
        console.log(choices)
        console.log('NEW CHOICES:')
        console.log(newChoices)
        qi_updates += 1

        // TODO: uncomment to trigger question instance updates
        // await prisma.questionInstance.update({
        //   where: { id: qi.id },
        //   data: {
        //     questionData: {
        //       ...qi.questionData,
        //       options: {
        //         ...qi.questionData.options,
        //         choices: newChoices,
        //       },
        //     },
        //   },
        // })
      }
    }
  }

  console.log('Done checking choices')
  console.log('Found', e_errors, 'elements with out of order choices')
  console.log('Found', ei_errors, 'element instances with out of order choices')
  console.log(
    'Found',
    qi_errors,
    'question instances with out of order choices'
  )

  console.log('Updated', e_updates, 'elements')
  console.log('Updated', ei_updates, 'element instances')
  console.log('Updated', qi_updates, 'question instances')
}

await run()
