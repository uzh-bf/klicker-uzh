import { InvocationContext } from '@azure/functions'
import { PrismaClient, QuestionInstanceType } from '@klicker-uzh/prisma'
import { getLegacyResults } from './getLegacyResults'
import {
  QuestionTypeMap,
  sendTeamsNotifications,
  sliceIntoChunks,
} from './utils'

export const importQuestionInstances = async (
  prisma: PrismaClient,
  importedQuestionInstances: any,
  mappedQuestionIds: Record<string, number>,
  user,
  batchSize: number,
  context: InvocationContext
) => {
  try {
    let mappedQuestionInstancesIds: Record<string, number> = {}
    const questions = await prisma.question.findMany({
      where: {
        id: {
          in: Object.values(mappedQuestionIds),
        },
      },
    })
    const questionInstancesInDb = await prisma.questionInstance.findMany({
      where: {
        originalId: {
          not: null,
        },
      },
    })
    const questionInstancesDict: Record<string, any> =
      questionInstancesInDb.reduce(
        (acc, qi) => ({
          ...acc,
          [qi.originalId]: qi,
        }),
        {}
      )

    const batches = sliceIntoChunks(importedQuestionInstances, 10)
    let lostResults: any[] = []

    for (const batch of batches) {
      const preparedQuestionInstances = (
        await Promise.allSettled(
          batch.map(async (questionInstance) => {
            const questionInstanceExists =
              questionInstancesDict[questionInstance._id]

            if (questionInstanceExists) {
              mappedQuestionInstancesIds[questionInstance._id] =
                questionInstanceExists.id
              return null
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

            if (
              questionInstance.results &&
              !questionInstance.results.CHOICES &&
              !questionInstance.results.FREE
            ) {
              questionInstance.results = await getLegacyResults(
                questionInstance._id
              )
              if (questionInstance.results == null) {
                lostResults.push(questionInstance)
              }
            }

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
                  let newResults = Object.keys(
                    questionInstance.results.FREE
                  ).reduce((acc, hash) => {
                    acc[hash] = questionInstance.results.FREE[hash]
                    return acc
                  }, {})
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

            return {
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
              createdAt: new Date(questionInstance.createdAt),
              updatedAt: new Date(questionInstance.updatedAt),
            }
          })
        )
      ).flatMap((result) => {
        if (result.status === 'fulfilled') {
          if (result.value !== null) {
            return [result.value]
          }
        }
        return []
      })

      await Promise.allSettled(
        preparedQuestionInstances.map((questionInstance) =>
          prisma.$transaction(async (prisma) => {
            const newQuestionInstance = await prisma.questionInstance.create({
              data: questionInstance,
            })

            mappedQuestionInstancesIds[questionInstance.originalId] =
              newQuestionInstance.id

            if (questionInstance.questionData.id) {
              await prisma.question.update({
                where: {
                  id: questionInstance.questionData.id,
                },
                data: {
                  instances: {
                    connect: {
                      id: newQuestionInstance.id,
                    },
                  },
                },
              })
            }
          })
        )
      )
    }

    context.log('mappedQuestionInstancesIds', mappedQuestionInstancesIds)

    context.log('lostResults.length: ', lostResults.length)
    return mappedQuestionInstancesIds
  } catch (error) {
    context.error(
      'Something went wrong while importing question instances: ',
      error
    )
    sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of question instances for user '${user.email}' because of ${error}`,
      context
    )
    throw error
  }
}
