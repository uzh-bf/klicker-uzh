// pn exec:prod scripts/fixQuestionData.ts

import { PrismaClient } from '@klicker-uzh/prisma'

const prisma = new PrismaClient()

const questionInstances = await prisma.questionInstance.findMany()

console.log(questionInstances.length)

questionInstances.forEach((questionInstance) => {
  const expectedKeys = [
    'id',
    'name',
    'type',
    'content',
    'options',
    'ownerId',
    'createdAt',
    'isDeleted',
    'updatedAt',
    'isArchived',
    'originalId',
    'displayMode', // TODO: will be moved to options
    'explanation',
    'pointsMultiplier', // TODO: will be moved to options
    'hasSampleSolution', // TODO: will be moved to options
    'hasAnswerFeedbacks', // TODO: will be moved to options
    'attachments', // TODO: could be purged from existing questionData
    'contentPlain', // TODO: could be purged from existing questionData
  ]

  const existingKeys = Object.keys(questionInstance.questionData)

  const difference = existingKeys.filter((key) => !expectedKeys.includes(key))
  if (difference.length !== 0) {
    console.log(difference)
  }
})

process.exit(0)
