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

    const batches = sliceIntoChunks(importedQuestionInstances, batchSize)
    let lostResults: any[] = []

    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const questionInstance of batch) {
          const questionInstanceExists =
            questionInstancesDict[questionInstance._id]

          if (questionInstanceExists) {
            mappedQuestionInstancesIds[questionInstance._id] =
              questionInstanceExists.id
            continue
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
          const newQuestionInstance = await prisma.questionInstance.create({
            data: result.data,
          })

          mappedQuestionInstancesIds[questionInstance._id] =
            newQuestionInstance.id

          if (questionId) {
            await prisma.question.update({
              where: {
                id: questionId,
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
        }
      })
    }

    context.log('lostResults.length: ', lostResults.length)
    return mappedQuestionInstancesIds
  } catch (error) {
    context.error(
      'Something went wrong while importing question instances: ',
      error
    )
    sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of question instances for user '${user.email}'`
    )
    throw new (error as any)()
  }
}
