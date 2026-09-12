import { prisma } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma/client'

// ? This script will relink all missing live session activities to the corresponding live quiz entries after their migration
async function run() {
  let missingChoicesSampleSolution = 0
  let missingChoicesAnswerFeedbacks = 0
  let surplusChoicesSampleSolution = 0
  let surplusChoicesAnswerFeedbacksSampleSolutionEnabled = 0
  let surplusChoicesAnswerFeedbacksSampleSolutionDisabled = 0

  let missingNumericalSampleSolution = 0
  let surplusNumericalSampleSolution = 0

  let missingFreeTextSampleSolution = 0
  let surplusFreeTextSampleSolution = 0

  // get the number of elements in the database
  const elementsCount = await prisma.element.count()
  console.log('Total elements:', elementsCount)

  // iterate over all elements in batches of 100
  for (let i = 0; i < elementsCount; i += 100) {
    const elements = await prisma.element.findMany({
      skip: i,
      take: 100,
    })

    console.log(
      'Processing batch',
      i / 100 + 1,
      'of',
      Math.ceil(elementsCount / 100)
    )

    for (const element of elements) {
      // check if the elements with sample solution (and answer feedbacks) enabled also have these fields set, otherwise disable the corresponding setting
      if (element.options.hasSampleSolution) {
        if (
          element.type === ElementType.SC ||
          element.type === ElementType.MC ||
          element.type === ElementType.KPRIM
        ) {
          if (element.options.length === 0) {
            throw new Error('Choices element has no choices')
          }

          const hasSolutionDefined = element.options.choices.every(
            (choice) =>
              typeof choice.correct !== 'undefined' && choice.correct !== null
          )
          const everyHasFeedbacksDefined = element.options.choices.every(
            (choice) =>
              typeof choice.feedback !== 'undefined' && choice.feedback !== null
          )
          const someHasFeedbackDefined = element.options.choices.some(
            (choice) =>
              typeof choice.feedback !== 'undefined' && choice.feedback !== null
          )

          if (!hasSolutionDefined) {
            throw new Error('Unexpected update (1) - investigate further')

            // ! (not detected in current prod DB)
            // sample solution is missing -> deactivate setting, remove all sample solutions and answer feedbacks
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       hasSampleSolution: false,
            //       hasAnswerFeedbacks: false,
            //       choices: element.options.choices.map((choice) => ({
            //         ...choice,
            //         correct: undefined,
            //         feedback: undefined,
            //       })),
            //     },
            //   },
            // })

            missingChoicesSampleSolution++
          } else if (
            element.options.hasAnswerFeedbacks &&
            !everyHasFeedbacksDefined
          ) {
            throw new Error('Unexpected update (2) - investigate further')

            // ! (not detected in current prod DB)
            // answer feedbacks are missing -> deactivate setting and remove all answer feedbacks
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       hasAnswerFeedbacks: false,
            //       choices: element.options.choices.map((choice) => ({
            //         ...choice,
            //         feedback: undefined,
            //       })),
            //     },
            //   },
            // })

            missingChoicesAnswerFeedbacks++
          } else if (
            !element.options.hasAnswerFeedbacks &&
            someHasFeedbackDefined
          ) {
            // ! UPDATE (detected in current prod DB)
            // answer feedbacks are defined, but not needed -> remove answer feedbacks
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       choices: element.options.choices.map((choice) => ({
            //         ...choice,
            //         feedback: undefined,
            //       })),
            //     },
            //   },
            // })

            // increment the corresponding count
            surplusChoicesAnswerFeedbacksSampleSolutionEnabled++
          }
        } else if (element.type === ElementType.NUMERICAL) {
          if (
            !('solutionRanges' in element.options) ||
            ('solutionRanges' in element.options &&
              element.options.solutionRanges &&
              element.options.solutionRanges.length === 0)
          ) {
            // ! UPDATE (detected in current prod DB)
            // sample solution is missing -> deactivate setting
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       hasSampleSolution: false,
            //       solutionRanges: undefined,
            //     },
            //   },
            // })

            missingNumericalSampleSolution++
          }
        } else if (element.type === ElementType.FREE_TEXT) {
          if (
            !('solutions' in element.options) ||
            ('solutions' in element.options &&
              element.options.solutions &&
              element.options.solutions.length === 0)
          ) {
            // ! UPDATE (detected in current prod DB)
            // sample solution is missing -> deactivate setting
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       hasSampleSolution: false,
            //       solutions: undefined,
            //     },
            //   },
            // })

            missingFreeTextSampleSolution++
          }
        } else if (
          element.type === ElementType.FLASHCARD ||
          element.type === ElementType.CONTENT
        ) {
          throw new Error(
            "Flashcards and content elements can't have sample solutions"
          )
        } else {
          console.log('Encountered element type:', element.type)
          throw new Error('Unexpected element type')
        }
      } else {
        if (
          element.type === ElementType.SC ||
          element.type === ElementType.MC ||
          element.type === ElementType.KPRIM
        ) {
          const hasSolutionDefined = element.options.choices.some(
            (choice) =>
              typeof choice.correct !== 'undefined' && choice.correct !== null
          )
          const hasFeedbacksDefined = element.options.choices.some(
            (choice) =>
              typeof choice.feedback !== 'undefined' && choice.feedback !== null
          )

          // check if sample solutions were specified even though the setting is disabled
          if (hasSolutionDefined || hasFeedbacksDefined) {
            // ! UPDATE (detected in current prod DB)
            // sample solution or answer feedback are defiend on some choice, even though setting is disabled --> remove sample solutions and answer feedbacks
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       hasSampleSolution: false,
            //       hasAnswerFeedbacks: false,
            //       choices: element.options.choices.map((choice) => ({
            //         ...choice,
            //         correct: undefined,
            //         feedback: undefined,
            //       })),
            //     },
            //   },
            // })

            // increment the corresponding count
            if (hasSolutionDefined) {
              surplusChoicesSampleSolution++
            }
            if (hasFeedbacksDefined) {
              surplusChoicesAnswerFeedbacksSampleSolutionDisabled++
            }
          }
        } else if (element.type === ElementType.NUMERICAL) {
          // sample solution is defined even though the setting is disabled
          if ('solutionRanges' in element.options) {
            // ! UPDATE (detected in current prod DB)
            // sample solution is defined, but not needed -> remove solution
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       solutionRanges: undefined,
            //       solutions: undefined,
            //     },
            //   },
            // })

            // ? caution: empty or null solutions are not considered in counts, but still removed as part of the cleanup
            // only count the cases where the solutions are not empty or null
            if (
              element.options.solutionRanges &&
              element.options.solutionRanges.length > 0
            ) {
              surplusNumericalSampleSolution++
            }
          }
        } else if (element.type === ElementType.FREE_TEXT) {
          // sample solution is defined even though the setting is disabled
          if ('solutions' in element.options) {
            // ! UPDATE (detected in current prod DB)
            // sample solution is defined, but not needed -> remove solution
            // await prisma.element.update({
            //   where: { id: element.id },
            //   data: {
            //     options: {
            //       ...element.options,
            //       solutionRanges: undefined,
            //       solutions: undefined,
            //     },
            //   },
            // })

            // ? caution: empty or null solutions are not considered in counts, but still removed as part of the cleanup
            // only count the cases where the solutions are not empty or null
            if (
              element.options.solutions &&
              element.options.solutions.length > 0
            ) {
              surplusFreeTextSampleSolution++
            }
          }
        } else if (
          element.type === ElementType.FLASHCARD ||
          element.type === ElementType.CONTENT
        ) {
          continue
        } else {
          console.log('Encountered element type:', element.type)
          throw new Error('Unexpected element type')
        }
      }
    }
  }

  // aggregated logging
  console.log('\n')
  console.log('Missing choices sample solution:', missingChoicesSampleSolution)
  console.log(
    'Missing choices answer feedbacks:',
    missingChoicesAnswerFeedbacks
  )
  console.log(
    'Missing numerical sample solution:',
    missingNumericalSampleSolution
  )
  console.log(
    'Missing free text sample solution:',
    missingFreeTextSampleSolution
  )
  console.log('\n')

  console.log('Surplus choices sample solution:', surplusChoicesSampleSolution)
  console.log(
    'Surplus choices answer feedbacks (sample solution enabled):',
    surplusChoicesAnswerFeedbacksSampleSolutionEnabled
  )
  console.log(
    'Surplus choices answer feedbacks (sample solution disabled):',
    surplusChoicesAnswerFeedbacksSampleSolutionDisabled
  )
  console.log(
    'Surplus numerical sample solution:',
    surplusNumericalSampleSolution
  )
  console.log(
    'Surplus free text sample solution:',
    surplusFreeTextSampleSolution
  )
}

await run()
