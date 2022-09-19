import Prisma from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import { omit } from 'ramda'

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
  courseId,
  ...args
}: {
  id: string
  password: string
  username: string
  courseId: string
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
        create: {
          course: {
            connect: {
              id: courseId,
            },
          },
        },
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
  options,
  ...args
}: {
  id: number
  name: string
  content: string
  contentPlain: string
  type: Prisma.QuestionType
  ownerId: string
  choices?: {
    value: string
    feedback?: string
    correct?: boolean
  }[]
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
}: {
  question: Partial<Prisma.Question>
}): any {
  const common = {
    questionData: omit(['createdAt', 'updatedAt', 'attachments'], question),
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

    case Prisma.QuestionType.NUMERICAL: {
      return {
        ...common,
        results: {
          answers: [],
        },
      }
    }

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
  content: string
  contentPlain: string
  type: Prisma.QuestionType
  options?: any
}

export function prepareLearningElement({
  questions,
  ...args
}: {
  id: string
  name: string
  displayName: string
  ownerId: string
  courseId: string
  questions: BaseQuestionData[]
}) {
  const preparedInstances = questions.map((question) =>
    prepareQuestionInstance({ question })
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
    update: args,
  }
}

export function prepareSession({
  blocks,
  ...args
}: {
  blocks: {
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
  isAudienceInteractionActive?: boolean
  isGamificationEnabled?: boolean
  linkTo?: string
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      blocks: {
        create: blocks.map(({ questions }) => {
          const preparedInstances = questions.map((question) =>
            prepareQuestionInstance({ question })
          )

          return {
            instances: {
              create: preparedInstances,
            },
          }
        }),
      },
    },
    update: args,
  }
}

export function prepareMicroSession({
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
}) {
  const preparedInstances = questions.map((question) =>
    prepareQuestionInstance({ question })
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
    update: args,
  }
}
