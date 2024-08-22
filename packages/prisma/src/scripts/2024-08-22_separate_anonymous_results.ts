import { getInitialElementResults } from '../../../util/dist'
import { ElementType, PrismaClient } from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  // ! PART 2: Update all group activity instances
  const groupActivityInstances = await prisma.elementInstance.findMany({
    where: {
      type: 'GROUP_ACTIVITY',
    },
    include: {
      element: true,
    },
  })

  const updatedInstancePromises = groupActivityInstances.map((instance) => {
    return prisma.elementInstance.update({
      where: {
        id: instance.id,
      },
      data: {
        anonymousResults: getInitialElementResults(instance.element),
      },
    })
  })
  prisma.$transaction(updatedInstancePromises)

  // ! PART 1: Link all question responses and details to the corresponding practice quiz / microlearning and course
  // fetch all instances
  let counter = 0
  let responseCounter = 0
  let inconsistentChoicesQuestions = 0
  let inconsistentOpenQuestions = 0
  let inconsistentFlashcards = 0
  let inconsistentContentElements = 0

  const instances = await prisma.elementInstance.findMany({
    where: {
      type: {
        in: ['PRACTICE_QUIZ', 'MICROLEARNING'],
      },
    },
    include: {
      responses: true,
      element: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
  const numOfInstsances = instances.length

  for (const instance of instances) {
    counter = counter + 1
    console.log(
      `Processing element instance ${counter}/${numOfInstsances} with id ${instance.id}`
    )

    let anonymousResults = JSON.parse(JSON.stringify(instance.results))
    let personalResults = getInitialElementResults(instance.element)

    // ! Loop over all responses, remove the corresponding answers from the anonymousResults and add them to the personalResults
    if (
      instance.elementType === ElementType.SC ||
      instance.elementType === ElementType.MC ||
      instance.elementType === ElementType.KPRIM
    ) {
      const initialResults = getInitialElementResults(instance.element)
      const summedResults = instance.responses.reduce((acc, curr) => {
        return {
          total: acc.total + curr.aggregatedResponses.total,
          choices: Object.keys(acc.choices).reduce((accChoices, key) => {
            return {
              ...accChoices,
              [key]: accChoices[key] + curr.aggregatedResponses.choices[key],
            }
          }, acc.choices),
        }
      }, initialResults)

      if (
        summedResults.total > instance.results.total ||
        Object.keys(summedResults.choices).some(
          (key) => summedResults.choices[key] > instance.results.choices[key]
        )
      ) {
        console.log(
          `INCONSISTENCY WARNING - AGGREGATED RESPONSES FOR INSTANCE ${instance.id}:`
        )
        console.log(instance.responses.map((r) => r.aggregatedResponses))
        console.log('PREVIOUS INSTANCE RESULTS:')
        console.log(instance.results)
        console.log('SUMMED RESULTS:')
        console.log(summedResults)
        console.error(
          `Detail responses contain more submissions than the total`
        )
        inconsistentChoicesQuestions = inconsistentChoicesQuestions + 1

        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = getInitialElementResults(instance.element)
        personalResults = summedResults

        console.log('NEW PERSONAL RESULTS')
        console.log(personalResults)
        console.log('NEW ANONYMOUS RESULTS')
        console.log(anonymousResults)
        console.log('\n\n\n')
      } else {
        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = {
          total: anonymousResults.total - summedResults.total,
          choices: Object.keys(anonymousResults.choices).reduce(
            (acc, key) => ({
              ...acc,
              [key]: acc[key] - summedResults.choices[key],
            }),
            anonymousResults.choices
          ),
        }
        personalResults = summedResults
      }
    } else if (instance.elementType === ElementType.NUMERICAL) {
      const summedResponses = instance.responses.reduce(
        (acc, curr) => {
          Object.keys(curr.aggregatedResponses.responses).forEach((key) => {
            if (!acc.responses[key]) {
              acc.responses[key] = curr.aggregatedResponses.responses[key]
            } else {
              acc.responses[key].count = acc.responses[key].count + 1
            }
          })

          acc.total = acc.total + curr.aggregatedResponses.total
          return acc
        },
        { total: 0, responses: {} }
      )

      // if the total number of responses is greater than the total number of submissions, there is an inconsistency
      // the same applies if there are responses in the detail responses that are not in the total responses
      if (
        summedResponses.total > instance.results.total ||
        Object.entries(summedResponses.responses).some(
          ([key, r]) =>
            !Object.keys(instance.results.responses).includes(key) ||
            r.count > instance.results.responses[key].count
        )
      ) {
        console.log(
          `INCONSISTENCY WARNING - AGGREGATED RESPONSES FOR INSTANCE ${instance.id}:`
        )
        console.log(instance.responses.map((r) => r.aggregatedResponses))
        console.log('PREVIOUS INSTANCE RESULTS:')
        console.log(instance.results)
        console.log('SUMMED RESULTS:')
        console.log(summedResponses)
        console.error(
          `Detail responses contain more submissions than the total`
        )
        inconsistentOpenQuestions = inconsistentOpenQuestions + 1

        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = getInitialElementResults(instance.element)
        personalResults = summedResponses

        console.log('NEW PERSONAL RESULTS')
        console.log(personalResults)
        console.log('NEW ANONYMOUS RESULTS')
        console.log(anonymousResults)
        console.log('\n\n\n')
      } else {
        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = {
          total: anonymousResults.total - summedResponses.total,
          responses: Object.keys(summedResponses.responses).reduce(
            (acc, key) => {
              if (acc[key].count - summedResponses.responses[key].count === 0) {
                delete acc[key]
              } else {
                acc[key].count =
                  acc[key].count - summedResponses.responses[key].count
              }

              return acc
            },
            anonymousResults.responses
          ),
        }
        personalResults = summedResponses
      }
    } else if (instance.elementType === ElementType.FLASHCARD) {
      const summedResponses = instance.responses.reduce(
        (acc, curr) => {
          return {
            total: acc.total + curr.aggregatedResponses.total,
            CORRECT: acc.CORRECT + curr.aggregatedResponses.CORRECT,
            PARTIAL: acc.PARTIAL + curr.aggregatedResponses.PARTIAL,
            INCORRECT: acc.INCORRECT + curr.aggregatedResponses.INCORRECT,
          }
        },
        { total: 0, INCORRECT: 0, PARTIAL: 0, CORRECT: 0 }
      )

      if (
        summedResponses.total > instance.results.total ||
        summedResponses.CORRECT > instance.results.CORRECT ||
        summedResponses.PARTIAL > instance.results.PARTIAL ||
        summedResponses.INCORRECT > instance.results.INCORRECT
      ) {
        console.log(
          `INCONSISTENCY WARNING - AGGREGATED RESPONSES FOR INSTANCE ${instance.id}:`
        )
        console.log(instance.responses.map((r) => r.aggregatedResponses))
        console.log('PREVIOUS INSTANCE RESULTS:')
        console.log(instance.results)
        console.log('SUMMED RESULTS:')
        console.log(summedResponses)
        console.error(
          `Detail responses contain more submissions than the total`
        )
        inconsistentFlashcards = inconsistentFlashcards + 1

        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = getInitialElementResults(instance.element)
        personalResults = summedResponses

        console.log('NEW PERSONAL RESULTS')
        console.log(personalResults)
        console.log('NEW ANONYMOUS RESULTS')
        console.log(anonymousResults)
        console.log('\n\n\n')
      } else {
        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = {
          total: anonymousResults.total - summedResponses.total,
          INCORRECT: anonymousResults.INCORRECT - summedResponses.INCORRECT,
          PARTIAL: anonymousResults.PARTIAL - summedResponses.PARTIAL,
          CORRECT: anonymousResults.CORRECT - summedResponses.CORRECT,
        }
        personalResults = summedResponses
      }
    } else if (instance.elementType === ElementType.CONTENT) {
      const summedResponses = instance.responses.reduce((acc, curr) => {
        return acc + curr.aggregatedResponses.total
      }, 0)

      if (summedResponses > instance.results.total) {
        console.log(
          `INCONSISTENCY WARNING - AGGREGATED RESPONSES FOR INSTANCE ${instance.id}:`
        )
        console.log(instance.responses.map((r) => r.aggregatedResponses))
        console.log('PREVIOUS INSTANCE RESULTS:')
        console.log(instance.results)
        console.log('NEW INSTANCE PERSONAL RESULTS:')
        console.log(personalResults)
        console.log('NEW INSTANCE ANONYMOUS RESULTS:')
        console.log(anonymousResults)
        console.error(
          `Detail responses contain more submissions than the total`
        )
        inconsistentContentElements = inconsistentContentElements + 1

        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = getInitialElementResults(instance.element)
        personalResults = { total: summedResponses }

        console.log('NEW PERSONAL RESULTS')
        console.log(personalResults)
        console.log('NEW ANONYMOUS RESULTS')
        console.log(anonymousResults)
        console.log('\n\n\n')
      } else {
        // update the results to the sum of all responses and reset the anonymous results
        anonymousResults = { total: anonymousResults.total - summedResponses }
        personalResults = { total: summedResponses }
      }
    } else {
      throw new Error(
        `Element type ${instance.elementType} is not supported in this script`
      )
    }

    // ! USE THIS STATEMENT TO EXECUTE UPDATES
    await prisma.elementInstance.update({
      where: {
        id: instance.id,
      },
      data: {
        results: personalResults,
        anonymousResults: anonymousResults,
      },
    })
  }

  console.log(`Evaluated ${numOfInstsances} instances in TOTAL`)
  console.log(
    `Updated all instances based on data from ${responseCounter} responses`
  )
  console.log(
    `Modified results for ${inconsistentChoicesQuestions} SC/MC/KPRIM questions`
  )
  console.log(
    `Modified results for ${inconsistentOpenQuestions} NR/FT questions`
  )
  console.log(`Modified results for ${inconsistentFlashcards} flashcards`)
  console.log(
    `Modified results for ${inconsistentContentElements} content elements`
  )
}

await run()
