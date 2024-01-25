import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import * as R from 'ramda'
import Turndown from 'turndown'
import { fileURLToPath } from 'url'
import { parseStringPromise } from 'xml2js'
import Prisma from '../../dist'
import {
  Element,
  ElementType,
  QuestionInstanceType,
  QuestionStackType,
  UserLoginScope,
} from '../client'

const RELEVANT_KEYS = [
  'id',
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processQuestionData(question: Prisma.Element) {
  const extractRelevantKeys = R.pick(RELEVANT_KEYS)

  return {
    ...extractRelevantKeys(question),
    id: `${question.id}-v${question.version}`,
    questionId: question.id,
  }
}

const FLASHCARD_KEYS = ['name', 'content', 'explanation', 'type']

export function processElementData(element: Element) {
  const extractFlashcardKeys = R.pick(FLASHCARD_KEYS)

  if (element.type === ElementType.FLASHCARD) {
    return {
      ...extractFlashcardKeys(element),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else {
    // TODO - add other types
  }
}

export async function prepareUser({
  name,
  password,
  catalystIndividual = false,
  catalystInstitutional = false,
  ...args
}: {
  id: string
  email: string
  name: string
  password: string
  shortname: string
  catalystIndividual?: boolean
  catalystInstitutional?: boolean
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    catalystIndividual,
    catalystInstitutional,
    firstLogin: false,
    logins: {
      create: {
        name: name,
        password: hashedPassword,
        scope: UserLoginScope.FULL_ACCESS,
      },
    },
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
  username,
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
    username,
    email: `${username}@test.uzh.ch`,
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

export function prepareQuestion({
  choices,
  content,
  options,
  ...args
}: {
  originalId: string
  name: string
  content: string
  type: Prisma.ElementType
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
      content,
      options: {
        ...options,
        choices: preparedChoices,
      },
    }

    return {
      where: {
        originalId: args.originalId,
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
      originalId: args.originalId,
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
  question: Partial<Prisma.Element>
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
    questionData: processQuestionData(question as Element),
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
    case Prisma.ElementType.SC:
    case Prisma.ElementType.MC:
    case Prisma.ElementType.KPRIM: {
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

    case Prisma.ElementType.NUMERICAL:
    case Prisma.ElementType.FREE_TEXT:
    case Prisma.ElementType.CONTENT:
    case Prisma.ElementType.FLASHCARD: {
      return {
        ...common,
        results: {
          participants: 0,
        },
      }
    }
  }
}

interface BaseQuestionData {
  id: number
  name: string
  pointsMultiplier: number
  content: string
  type: Prisma.ElementType
  options?: any
}

interface StackData {
  displayName?: string
  description?: string
  elements: (BaseQuestionData | String)[]
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
  stacks: StackData[]
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
            displayName: stack.displayName,
            description: stack.description,
            elements: {
              create: stack.elements.map((element, ixInner) => {
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
            displayName: stack.displayName,
            description: stack.description,
            elements: {
              create: stack.elements.map((element, ixInner) => {
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

export async function preparePracticeQuiz({
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
  stacks: StackData[]
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
            displayName: stack.displayName,
            description: stack.description,
            elements: {
              create: stack.elements.map((element, ixInner) => {
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
            displayName: stack.displayName,
            description: stack.description,
            elements: {
              create: stack.elements.map((element, ixInner) => {
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
  arePushNotificationsSent: boolean
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

export function extractQuizInfo(doc: typeof xmlDoc) {
  const turndown = Turndown()

  return {
    title: doc.box.title[0],
    description: doc.box.description[0],
    elements: doc.box.cards[0].card.map((card) => ({
      originalId: card['$'].id,
      name: `FC ${card['$'].id}`,
      content: turndown.turndown(card.question[0].text[0].trim()),
      explanation: turndown.turndown(card.answer[0].text[0].trim()),
      type: ElementType.FLASHCARD,
      options: {},
    })),
    // ... other practice quiz properties
  }
}

export async function processQuizInfo(fileName: string) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const xmlData = fs.readFileSync(path.join(__dirname, fileName), 'utf-8')

  const xmlDoc = await parseStringPromise(xmlData)

  // console.log(xmlDoc, xmlDoc.box.cards[0])

  const quizInfo = extractQuizInfo(xmlDoc)

  return quizInfo
}

export async function prepareFlashcardsFromFile(
  prismaClient: Prisma.PrismaClient,
  fileName: string,
  userId: string
) {
  const quizInfo = await processQuizInfo(fileName)

  const elementsFC = await Promise.allSettled(
    quizInfo.elements.map(async (data) => {
      const flashcard = await prismaClient.element.upsert({
        where: {
          originalId: data.originalId,
        },
        create: {
          ...data,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
        update: {
          ...data,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
      })
      return flashcard
    })
  )

  if (elementsFC.some((el) => el.status === 'rejected')) {
    throw new Error('Failed to seed some flashcard elements')
  }

  const elements = elementsFC.map((el) => el.value)

  return elements
}
