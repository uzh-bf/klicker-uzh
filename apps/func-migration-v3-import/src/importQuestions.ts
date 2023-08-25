import { InvocationContext } from '@azure/functions'
import { PrismaClient } from '@klicker-uzh/prisma'
import { QuestionTypeMap, sliceIntoChunks } from './utils'

export const importQuestions = async (
  prisma: PrismaClient,
  importedQuestions: any,
  mappedTags: Record<string, Record<string, string | number>>,
  user,
  batchSize: number,
  mappedFileURLs: Record<string, Record<string, string>>,
  context: InvocationContext
) => {
  let mappedQuestionIds: Record<string, number> = {}
  const questionsInDb = await prisma.question.findMany()

  const questionsDict: Record<string, any> = questionsInDb.reduce(
    (acc, cur) => {
      if (cur.originalId != null) {
        acc[cur.originalId] = cur
      }
      return acc
    },
    {}
  )

  const batches = sliceIntoChunks(importedQuestions, batchSize)
  try {
    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const question of batch) {
          const questionExists = questionsDict[question._id]

          if (questionExists) {
            context.log('question already exists: ', questionExists)
            mappedQuestionIds[question._id] = questionExists.id
            continue
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
                connect: question.tags.map((oldTagId) => {
                  const tagName = mappedTags[oldTagId].name
                  return {
                    ownerId_name: {
                      ownerId: user.id,
                      name: tagName,
                    },
                  }
                }),
              },
              owner: {
                connect: {
                  id: user.id,
                },
              },
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
            // return result
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
            // return result
          } else if (question.type === 'FREE') {
            result.data.options = {
              restrictions: {},
              solutions: [],
            }
            // return result
          } else {
            throw new Error('Unknown question type')
          }

          const newQuestion = await prisma.question.create({
            data: result.data,
          })
          mappedQuestionIds[question._id] = newQuestion.id
        }
      })
    }
  } catch (error) {
    context.error('Something went wrong while importing questions: ', error)
  }
  return mappedQuestionIds
}
