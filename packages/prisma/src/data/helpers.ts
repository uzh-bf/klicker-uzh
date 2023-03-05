import Prisma from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import * as R from 'ramda'
import { QuestionInstanceType, QuestionStackType } from '../client'

export async function prepareUser({
  password,
  ...args
}: {
  id: string
  email: string
  password: string
  shortname: string
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    password: hashedPassword,
    isActive: true,
  }

  return {
    where: { id: args.id },
    create: data,
    update: data,
  }
}

export function prepareCourse({
  ownerId,
  ...args
}: {
  id: string
  name: string
  displayName: string
  ownerId: string
  color?: string
  pinCode?: number
  startDate: Date
  endDate: Date
  notificationEmail?: string
}) {
  const data = {
    ...args,
    owner: {
      connect: {
        id: ownerId,
      },
    },
  }

  return {
    where: { id: args.id },
    create: data,
    update: data,
  }
}

export async function prepareParticipant({
  password,
  courseIds,
  ...args
}: {
  id: string
  password: string
  username: string
  courseIds: string[]
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    password: hashedPassword,
  }

  return {
    where: { id: args.id },
    create: {
      ...data,
      participations: {
        create: courseIds.map((id) => ({
          course: {
            connect: {
              id,
            },
          },
        })),
      },
    },
    update: data,
  }
}

export function prepareAttachment({
  ownerId,
  ...args
}: {
  id: string
  ownerId: string
  name: string
  href: string
  type: Prisma.AttachmentType
}) {
  const data = {
    ...args,
    owner: {
      connect: {
        id: ownerId,
      },
    },
  }

  return {
    where: {
      id: args.id,
    },
    create: data,
    update: data,
  }
}

export function prepareQuestion({
  choices,
  content,
  options,
  ...args
}: {
  id: number
  name: string
  content: string
  type: Prisma.QuestionType
  ownerId: string
  choices?: {
    value: string
    feedback?: string
    correct?: boolean
  }[]
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
  options?: any
}) {
  if (choices) {
    const preparedChoices = choices.map((choice, ix) => ({
      ix,
      value: choice.value,
      feedback: choice.feedback,
      correct: choice.correct ?? false,
    }))

    const data = {
      ...args,
      content,
      options: {
        choices: preparedChoices,
      },
    }

    return {
      where: {
        id: args.id,
      },
      create: data,
      update: data,
    }
  }

  const data = {
    ...args,
    content,
    options: options ?? {},
  }

  return {
    where: {
      id: args.id,
    },
    create: data,
    update: data,
  }
}

export function prepareQuestionInstance({
  question,
  type,
  pointsMultiplier,
  resetTimeDays,
  order,
}: {
  question: Partial<Prisma.Question>
  type: QuestionInstanceType
  pointsMultiplier?: number
  resetTimeDays?: number
  order?: number
}): any {
  const common = {
    order,
    type,
    pointsMultiplier,
    resetTimeDays,
    questionData: R.omit(['createdAt', 'updatedAt', 'attachments'], question),
    question: {
      connect: {
        id: question.id,
      },
    },
    owner: {
      connect: {
        id: question.ownerId,
      },
    },
  }

  switch (question.type) {
    case Prisma.QuestionType.SC:
    case Prisma.QuestionType.MC:
    case Prisma.QuestionType.KPRIM: {
      const questionOptions = question.options?.valueOf() as {
        choices: {
          ix: number
          value: string
          feedback: string
          correct: boolean
        }[]
      }

      return {
        ...common,
        results: {
          choices: questionOptions.choices.reduce(
            (acc, choice) => ({
              ...acc,
              [choice.ix]: 0,
            }),
            {}
          ),
        },
      }
    }

    case Prisma.QuestionType.NUMERICAL:
    case Prisma.QuestionType.FREE_TEXT: {
      return {
        ...common,
        results: {},
      }
    }
  }
}

interface BaseQuestionData {
  id: number
  name: string
  pointsMultiplier: number
  content: string
  type: Prisma.QuestionType
  options?: any
}

export async function prepareLearningElement({
  stacks,
  ...args
}: {
  id: string
  name: string
  displayName: string
  description?: string
  pointsMultiplier?: number
  resetTimeDays?: number
  orderType?: Prisma.OrderType
  ownerId: string
  courseId: string
  stacks: (BaseQuestionData | String)[][]
  status?: Prisma.LearningElementStatus
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      id: args.id,
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      pointsMultiplier: args.pointsMultiplier,
      resetTimeDays: args.resetTimeDays,
      status: args.status,
      orderType: args.orderType,
      owner: {
        connect: {
          id: args.ownerId,
        },
      },
      course: {
        connect: {
          id: args.courseId,
        },
      },
      stacks: {
        create: await Promise.all(
          stacks.map(async (stack, ix) => ({
            type: QuestionStackType.LEARNING_ELEMENT,
            order: ix,
            elements: {
              create: stack.map((element, ixInner) => {
                if (typeof element === 'string') {
                  return { order: ixInner, mdContent: element }
                }
                return {
                  order: ixInner,
                  questionInstance: {
                    create: prepareQuestionInstance({
                      order: 0,
                      question: element,
                      pointsMultiplier: args.pointsMultiplier
                        ? args.pointsMultiplier * element.pointsMultiplier
                        : undefined,
                      resetTimeDays: args.resetTimeDays,
                      type: QuestionInstanceType.LEARNING_ELEMENT,
                    }),
                  },
                }
              }),
            },
          }))
        ),
      },
    },
    update: {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      pointsMultiplier: args.pointsMultiplier,
      resetTimeDays: args.resetTimeDays,
      status: args.status,
      orderType: args.orderType,
      stacks: {
        create: await Promise.all(
          stacks.map(async (stack, ix) => ({
            type: QuestionStackType.LEARNING_ELEMENT,
            order: ix,
            elements: {
              create: stack.map((element, ixInner) => {
                if (typeof element === 'string') {
                  return { order: ixInner, mdContent: element }
                }
                return {
                  order: ixInner,
                  questionInstance: {
                    create: prepareQuestionInstance({
                      order: 0,
                      question: element,
                      pointsMultiplier: args.pointsMultiplier
                        ? args.pointsMultiplier * element.pointsMultiplier
                        : undefined,
                      resetTimeDays: args.resetTimeDays,
                      type: QuestionInstanceType.LEARNING_ELEMENT,
                    }),
                  },
                }
              }),
            },
          }))
        ),
      },
    },
  }
}

export async function prepareSession({
  blocks,
  ...args
}: {
  blocks: {
    order: number
    questions: BaseQuestionData[]
    expiresAt?: Date
    timeLimit?: number
  }[]
  id: string
  name: string
  displayName: string
  courseId: string
  ownerId: string
  status: Prisma.SessionStatus
  isModerationEnabled?: boolean
  isLiveQAEnabled?: boolean
  isConfusionFeedbackEnabled?: boolean
  isGamificationEnabled?: boolean
  linkTo?: string
  pointsMultiplier?: number
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      blocks: {
        create: await Promise.all(
          blocks.map(async ({ questions, ...rest }) => {
            const questionData = await Promise.all(questions)

            if (R.any(R.isNil, questionData)) {
              throw new Error('Invalid question data')
            }

            const preparedInstances = questionData.map((question, ix) =>
              prepareQuestionInstance({
                order: ix,
                question,
                type: QuestionInstanceType.SESSION,
                pointsMultiplier: args.pointsMultiplier,
              })
            )

            return {
              ...rest,
              instances: {
                create: preparedInstances,
              },
            }
          })
        ),
      },
    },
    update: {
      ...args,
      blocks: {
        upsert: await Promise.all(
          blocks.map(async ({ questions, ...rest }) => {
            const questionData = await Promise.all(questions)

            if (R.any(R.isNil, questionData)) {
              throw new Error('Invalid question data')
            }

            const preparedInstances = questionData.map((question, ix) =>
              prepareQuestionInstance({
                order: ix,
                question,
                type: QuestionInstanceType.SESSION,
              })
            )

            return {
              where: {
                sessionId_order: {
                  sessionId: args.id,
                  order: rest.order,
                },
              },
              create: {
                ...rest,
                instances: {
                  create: preparedInstances,
                },
              },
              // TODO: upsert instances that are added to blocks? (need to get session block id)
              update: {
                ...rest,
              },
            }
          })
        ),
      },
    },
  }
}

export async function prepareMicroSession({
  questions,
  ...args
}: {
  id: string
  name: string
  displayName: string
  scheduledStartAt: Date
  scheduledEndAt: Date
  description: string
  courseId: string
  ownerId: string
  questions: BaseQuestionData[]
  status: Prisma.MicroSessionStatus
}) {
  const questionData = await Promise.all(questions)

  if (R.any(R.isNil, questionData)) {
    throw new Error('Invalid question data')
  }

  const preparedInstances = questionData.map((question, ix) =>
    prepareQuestionInstance({
      order: ix,
      question,
      type: QuestionInstanceType.MICRO_SESSION,
    })
  )

  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      instances: {
        create: preparedInstances,
      },
    },
    update: {
      ...args,
      instances: {
        upsert: preparedInstances.map((instance) => ({
          where: {
            type_microSessionId_order: {
              type: QuestionInstanceType.MICRO_SESSION,
              microSessionId: args.id,
              order: instance.order,
            },
          },
          create: instance,
          update: {
            ...R.pick([], instance),
          },
        })),
      },
    },
  }
}
