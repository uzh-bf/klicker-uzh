import { ElementType, PrismaClient } from '@klicker-uzh/prisma'

async function run() {
  const prisma = new PrismaClient()
  const verbose = false // verbose logging setting

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
  for (const e of es) {
    if (
      (e.type === ElementType.SC ||
        e.type === ElementType.MC ||
        e.type === ElementType.KPRIM) &&
      (e.type === ElementType.SC ||
        e.type === ElementType.MC ||
        e.type === ElementType.KPRIM)
    ) {
      const choices = e.options.choices

      // check if choices are in order with ix attribute
      if (choices.some((c, index) => c.ix !== index)) {
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
  for (const ei of eis) {
    if (
      (ei.elementType === ElementType.SC ||
        ei.elementType === ElementType.MC ||
        ei.elementType === ElementType.KPRIM) &&
      (ei.elementData.type === ElementType.SC ||
        ei.elementData.type === ElementType.MC ||
        ei.elementData.type === ElementType.KPRIM)
    ) {
      const choices = ei.elementData.options.choices

      // check if choices are in order with ix attribute
      if (choices.some((c, index) => c.ix !== index)) {
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

        // if no sample solution has been specified, simply fix the indices
        if (choices.every((c) => c.correct === false)) {
          const newChoices = choices.map((c, index) => ({
            ...c,
            ix: index,
          }))

          console.log('OLD CHOICES:')
          console.log(choices)
          console.log('NEW CHOICES:')
          console.log(newChoices)

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
  }

  let qi_errors = 0
  for (const qi of qis) {
    if (
      qi.questionData.type === ElementType.SC ||
      qi.questionData.type === ElementType.MC ||
      qi.questionData.type === ElementType.KPRIM
    ) {
      const choices = qi.questionData.options.choices

      // check if choices are in order with ix attribute
      if (choices.some((c, index) => c.ix !== index)) {
        qi_errors += 1

        if (verbose) {
          console.error(
            `QuestionInstance ${qi.id} has choices out of order: ${choices
              .map((c) => c.ix)
              .join(', ')}`
          )
        }

        // if no sample solution has been specified, simply fix the indices
        if (choices.every((c) => c.correct === false)) {
          const newChoices = choices.map((c, index) => ({
            ...c,
            ix: index,
          }))

          console.log('OLD CHOICES:')
          console.log(choices)
          console.log('NEW CHOICES:')
          console.log(newChoices)

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
  }

  console.log('Done checking choices')
  console.log('Found', e_errors, 'elements with out of order choices')
  console.log('Found', ei_errors, 'element instances with out of order choices')
  console.log(
    'Found',
    qi_errors,
    'question instances with out of order choices'
  )
}

await run()
