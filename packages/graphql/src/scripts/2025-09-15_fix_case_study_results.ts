import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  LiveQuizResponse,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import {
  ElementData,
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
} from '@klicker-uzh/types'
import { getInitialInstanceResults } from '@klicker-uzh/util'
import { createHash } from 'node:crypto'

// ! IMPORTANT INFORMATION
// BEFORE DB MIGRATION: Run this script with the setting set to "NUMERICAL" to set numerical pins for all assessment quizzes
// (required due to a constraint introduced on the pin field and the assessment setting of the live quiz)
// AFTER DB MIGRATION: Re-run this script with the setting set to "ALPHANUMERIC" to set alphanumeric pins for all assessment quizzes

const blockId = 0
const liveQuizId = ''

function aggregateLiveQuizResponses({
  responses,
  elementData,
}: {
  responses: LiveQuizResponse[]
  elementData: ElementData
}): ElementInstanceResults {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsChoices
      return responses.reduce<ElementResultsChoices>((acc, submission) => {
        if (!('choices' in submission.response)) return acc

        acc.total += 1
        submission.response.choices.forEach((choice) => {
          if (choice.selected && choice.ix in acc.choices) {
            acc.choices[choice.ix] = (acc.choices[choice.ix] ?? 0) + 1
          }
        })

        return acc
      }, initialResults)
    }
    case 'NUMERICAL': {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!('value' in submission.response)) return acc

        const cleanResponseValue = parseFloat(String(submission.response.value))
        if (!isNaN(cleanResponseValue)) {
          const MD5 = createHash('md5')
          MD5.update(String(cleanResponseValue))
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: String(cleanResponseValue),
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case 'FREE_TEXT': {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!('value' in submission.response)) return acc

        const cleanResponseValue = submission.response.value.trim()
        if (cleanResponseValue.length > 0) {
          const MD5 = createHash('md5')
          MD5.update(cleanResponseValue)
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: cleanResponseValue,
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case ElementType.SELECTION: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsSelection

      return responses.reduce<ElementResultsSelection>((acc, submission) => {
        if (!('selection' in submission.response)) return acc

        submission.response.selection
          .filter((ix) => ix !== -1 && typeof ix !== 'undefined' && ix !== null)
          .forEach((ix) => {
            if (ix in acc.selections) {
              acc.selections[ix] = (acc.selections[ix] ?? 0) + 1
            }
          })

        acc.total += 1
        return acc
      }, initialResults)
    }
    case ElementType.CASE_STUDY: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsCaseStudy

      return responses.reduce<ElementResultsCaseStudy>((acc, submission) => {
        if (!('assessment' in submission.response)) return acc

        Object.entries(submission.response.assessment).forEach(
          ([caseId, itemResponses]) => {
            Object.entries(itemResponses).forEach(
              ([itemId, criterionResponses]) => {
                Object.entries(criterionResponses).forEach(
                  ([criterionId, criterionResponse]) => {
                    if (
                      criterionResponse === null ||
                      typeof criterionResponse !== 'number' ||
                      typeof acc.assessments[caseId]?.[itemId]?.[
                        criterionId
                      ] === 'undefined'
                    ) {
                      console.log('INVALID RESPONSE:', submission.response)
                      return
                    }

                    // compute the hash of the response
                    const MD5 = createHash('md5')
                    MD5.update(String(criterionResponse))
                    const responseHash = MD5.digest('hex')

                    // if the response already exists, increment the counter, otherwise create a new entry
                    if (
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ]
                    ) {
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ]!.count += 1
                    } else {
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ] = {
                        value: criterionResponse,
                        count: 1,
                      }
                    }
                  }
                )
              }
            )
          }
        )

        acc.total += 1
        return acc
      }, initialResults)
    }
    case 'CONTENT': {
      return { total: responses.length }
    }
    default:
      return { total: 0 }
  }
}

async function run() {
  // verify that the live quiz is still running or ended (-> results of aborted live quizzes should not be updated)
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: liveQuizId, status: { in: ['PUBLISHED', 'ENDED'] } },
    include: {
      blocks: {
        include: { elements: { include: { liveQuizResponses: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!quiz) {
    return true
  }
  if (quiz.blocks.length === 0) {
    return false
  }

  // check if the block that was closed is the last one of the quiz
  const isLastBlock = quiz.blocks[quiz.blocks.length - 1]!.id === blockId
  const block = quiz.blocks.find((b) => b.id === blockId)
  if (!block) {
    return false
  }
  if (block.elements.length === 0) {
    return false
  }

  if (block.elements.every((el) => el.liveQuizResponses.length === 0)) {
    return true
  }

  try {
    // update the instance results based on the live quiz response entries
    await prisma.liveQuiz.update({
      where: { id: liveQuizId },
      data: {
        blocks: {
          update: {
            where: { id: blockId },
            data: {
              elements: {
                update: block.elements.map((instance) => ({
                  where: { id: Number(instance.id) },
                  // update the anonymous results for regular live quizzes and the normal results for assessment live quizzes
                  data: {
                    anonymousResults: quiz.isAssessmentEnabled
                      ? undefined
                      : aggregateLiveQuizResponses({
                          responses: instance.liveQuizResponses,
                          elementData: instance.elementData,
                        }),
                    results: quiz.isAssessmentEnabled
                      ? aggregateLiveQuizResponses({
                          responses: instance.liveQuizResponses,
                          elementData: instance.elementData,
                        })
                      : undefined,
                  },
                })),
              },
            },
          },
        },
      },
    })
  } catch (error) {
    console.log(error)
  }
}

await run()
