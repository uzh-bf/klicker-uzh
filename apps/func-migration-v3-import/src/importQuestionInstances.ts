import { InvocationContext } from '@azure/functions'
import { PrismaClient, QuestionInstanceType } from '@klicker-uzh/prisma'
import { getLegacyResults } from './getLegacyResults'
import {
  QuestionTypeMap,
  sendTeamsNotifications,
  sliceIntoChunks,
} from './utils'

const restoreLostLegacyResults = async (
  importedQuestionInstances: any,
  // mappedQuestionInstances: Record<string, Record<string, any>>,
  questionInstancesDict: Record<string, any>
) => {
  let mappedQuestionInstances: Record<string, Record<string, any>> = {}
  let lostResults: any[] = []

  // for-loop kept due to its asynchronous nature
  for (const questionInstance of importedQuestionInstances) {
    const questionInstanceExists = questionInstancesDict[questionInstance._id]

    if (questionInstanceExists) {
      mappedQuestionInstances[questionInstance._id] = questionInstanceExists.id
      continue
    }

    if (
      questionInstance.results &&
      !questionInstance.results.CHOICES &&
      !questionInstance.results.FREE
    ) {
      mappedQuestionInstances[questionInstance._id]['lostResults'] =
        await getLegacyResults(questionInstance._id)
      if (questionInstance.results == null) {
        lostResults.push(questionInstance)
      }
    }
  }
  return [mappedQuestionInstances, lostResults]
}

const processResults = (questionData: any, questionInstance: any) => {
  let results = {}

  if (questionInstance.results) {
    if (questionData.type === 'SC' || questionData.type === 'MC') {
      if (questionInstance.results.CHOICES) {
        results = questionInstance.results.CHOICES.reduce(
          (acc, choice, idx) => {
            acc[idx.toString()] = {
              count: choice,
              value: idx.toString(),
            }
            return acc
          },
          {}
        )
      }
    } else if (
      questionData.type === QuestionTypeMap['FREE'] ||
      questionData.type === QuestionTypeMap['FREE_RANGE']
    ) {
      if (questionInstance.results.FREE) {
        let newResults = Object.keys(questionInstance.results.FREE).reduce(
          (acc, hash) => {
            acc[hash] = questionInstance.results.FREE[hash]
            return acc
          },
          {}
        )
        results = { ...results, ...newResults }
      } else if (questionInstance.results.FREE_RANGE) {
        let newResults = Object.keys(
          questionInstance.results.FREE_RANGE
        ).reduce((acc, hash) => {
          acc[hash] = questionInstance.results.FREE_RANGE[hash]
          return acc
        }, {})
        results = { ...results, ...newResults }
      }
    }
  }

  return results
}

export const importQuestionInstances = async (
  prisma: PrismaClient,
  importedQuestionInstances: any,
  mappedQuestionIds: Record<string, number>,
  user,
  batchSize: number,
  context: InvocationContext
) => {
  try {
    // let mappedQuestionInstances: Record<string, Record<string, any>> = {}
    const questions = await Promise.all(
      Object.values(mappedQuestionIds).map((questionId) =>
        prisma.question.findUnique({ where: { id: questionId } })
      )
    )
    const questionInstancesInDb = await prisma.questionInstance.findMany()
    const questionInstancesDict: Record<string, any> =
      questionInstancesInDb.reduce((acc, qi) => {
        if (qi.originalId != null) {
          acc[qi.originalId] = qi
        }
        return acc
      }, {})

    //TODO: adjust mappedQuestionInstancesIds in other files as well where used
    let [mappedQuestionInstances, lostResults] = await restoreLostLegacyResults(
      importedQuestionInstances,
      questionInstancesDict
    )

    const batches = sliceIntoChunks(importedQuestionInstances, 1)
    for (const batch of batches) {
      const createdQuestionInstances = await prisma.$transaction(
        batch.flatMap((questionInstance) => {
          const questionInstanceExists =
            questionInstancesDict[questionInstance._id]

          if (questionInstanceExists) {
            mappedQuestionInstances[questionInstance._id] =
              questionInstanceExists.id
            return []
          }

          let questionData = {}
          let questionId = null
          const question = questions.find(
            (question) =>
              question.id === mappedQuestionIds[questionInstance.question]
          )

          if (question) {
            questionData = {
              ...question,
            }
            questionId = question?.id
          }

          const results = processResults(questionData, questionInstance)

          const result = {
            data: {
              originalId: questionInstance._id,
              type: QuestionInstanceType.SESSION,
              questionData: questionData,
              participants: questionInstance.results?.totalParticipants,
              results: results,
              owner: {
                connect: {
                  id: user.id,
                },
              },
              question: questionId
                ? {
                    connect: {
                      id: questionId,
                    },
                  }
                : undefined,
              // responses: only import aggregated results
              // blockedParticipants
              // dropped: not relevant for now (für die wahlen wichtig)
            },
          }
          return [
            prisma.questionInstance.create({
              data: result.data,
            }),
          ]
        })
      )

      createdQuestionInstances.forEach((newQuestionInstance) => {
        mappedQuestionInstances[newQuestionInstance.originalId]['newId'] =
          newQuestionInstance.id
      })

      // restore results for created question instances
      const updatedQuestionInstances = await prisma.$transaction(
        createdQuestionInstances.flatMap((questionInstance) => {
          const lostResultsExist =
            mappedQuestionInstances[questionInstance.originalId]['lostResults']

          if (lostResultsExist) {
            const results = processResults(
              questionInstance.questionData,
              lostResultsExist
            )
            return [
              prisma.questionInstance.update({
                where: {
                  id: questionInstance.id,
                },
                data: {
                  results: results,
                },
              }),
            ]
          } else {
            return []
          }
        })
      )

      const updatedQuestions = await prisma.$transaction(
        createdQuestionInstances.flatMap((questionInstance) => {
          const questionId =
            mappedQuestionIds[questionInstance.questionData._id]
          if (questionId) {
            return [
              prisma.question.update({
                where: {
                  id: questionId,
                },
                data: {
                  instances: {
                    connect: {
                      id: questionInstance.id,
                    },
                  },
                },
              }),
            ]
          } else {
            return []
          }
        })
      )
    }

    context.log('lostResults.length: ', lostResults.length)
    return mappedQuestionInstances
  } catch (error) {
    context.error(
      'Something went wrong while importing question instances: ',
      error
    )
    sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of question instances for user '${user.email}' because of ${error}`
    )
    throw error
  }
}
