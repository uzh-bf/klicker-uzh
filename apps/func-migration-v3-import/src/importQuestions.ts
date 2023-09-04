import { InvocationContext } from '@azure/functions'
import { PrismaClient } from '@klicker-uzh/prisma'
import {
  QuestionTypeMap,
  sendTeamsNotifications,
  sliceIntoChunks,
} from './utils'

export const importQuestions = async (
  prisma: PrismaClient,
  importedQuestions: any,
  mappedTags: Record<string, Record<string, string | number>>,
  user,
  batchSize: number,
  mappedFileURLs: Record<string, Record<string, string>>,
  context: InvocationContext
) => {
  try {
    let mappedQuestionIds: Record<string, number> = {}
    const questionsInDb = await prisma.question.findMany({
      where: {
        originalId: {
          not: null,
        },
        owner: {
          id: user.id,
        },
      },
    })

    const questionsDict: Record<string, any> = questionsInDb.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.originalId]: cur,
      }),
      {}
    )

    const batches = sliceIntoChunks(importedQuestions, 20)

    for (const batch of batches) {
      const preparedQuestions = batch.flatMap((question) => {
        const questionExists = questionsDict[question._id]

        if (questionExists) {
          mappedQuestionIds[question._id] = questionExists.id
          return []
        }

        const result = {
          data: {
            originalId: question._id,
            name: question.title,
            type: QuestionTypeMap[question.type],
            content:
              question.versions.content +
              (question.versions.files?.length > 0
                ? '\n' +
                  question.versions.files
                    .map(
                      (fileId: string) =>
                        `![${mappedFileURLs[fileId].originalName}](${mappedFileURLs[fileId].url})`
                    )
                    .join('\n\n') +
                  '\n'
                : ''),
            options: {},
            hasSampleSolution: false,
            isDeleted: question.isDeleted,
            isArchived: question.isArchived,
            tags: {
              connect: question.tags.flatMap((oldTagId) => {
                if (!mappedTags[oldTagId]) {
                  context.log('Tag not found: ', oldTagId)
                  return []
                }
                const tagName = mappedTags[oldTagId].name
                return [
                  {
                    ownerId_name: {
                      ownerId: user.id,
                      name: tagName,
                    },
                  },
                ]
              }),
            },
            owner: {
              connect: {
                id: user.id,
              },
            },
            createdAt: new Date(question.createdAt),
            updatedAt: new Date(question.updatedAt),
          },
        }

        if (['SC', 'MC'].includes(question.type)) {
          result.data.options = {
            choices: question.versions.options[question.type].choices.map(
              (choice, ix) => {
                if (choice.correct) result.data.hasSampleSolution = true
                return {
                  ix,
                  value: choice.name,
                  correct: choice.correct,
                  feedback: '',
                }
              }
            ),
          }
        } else if (question.type === 'FREE_RANGE') {
          // throw new Error('Unsupported question type NR')
          const restrictions =
            question.versions.options.FREE_RANGE?.restrictions
          if (!restrictions) {
            result.data.options = {
              restrictions: undefined,
              solutions: [],
              solutionRanges: [],
            }
          } else {
            result.data.options = {
              restrictions: {
                min: restrictions.min !== null ? restrictions.min : undefined,
                max: restrictions.max !== null ? restrictions.max : undefined,
              },
              solutions: [],
              solutionRanges: [],
            }
          }
        } else if (question.type === 'FREE') {
          result.data.options = {
            restrictions: {},
            solutions: [],
          }
        } else {
          return []
        }

        return [result]
      })

      const createdQuestions = await prisma.$transaction(
        preparedQuestions.map((data) => prisma.question.create(data))
      )

      createdQuestions.forEach((question) => {
        mappedQuestionIds[question.originalId] = question.id
      })
    }

    context.log('mappedQuestionIds: ', mappedQuestionIds)

    return mappedQuestionIds
  } catch (error) {
    context.error('Something went wrong while importing questions: ', error)
    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of questions for user '${user.email}' because of ${error}`,
      context
    )
    throw error
  }
}
