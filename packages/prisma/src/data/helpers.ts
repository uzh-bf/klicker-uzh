import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
  processQuestionData,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import * as R from 'ramda'
import Turndown from 'turndown'
import { fileURLToPath } from 'url'
import { parseStringPromise } from 'xml2js'
import Prisma from '../../dist/index.js'
import {
  ElementType,
  QuestionInstanceType,
  UserLoginScope,
  type Element,
} from '../prisma/client/index.js'

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
        name: name.trim(),
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
  description?: string
  isGamificationEnabled: boolean
  ownerId: string
  color?: string
  pinCode: number
  startDate: Date
  endDate: Date
  groupDeadlineDate: Date
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

export function prepareGroupActivityStack({
  flashcards,
  questions,
  contentElements,
  courseId,
  connectStackToCourse,
  migrationIdOffset,
}: {
  flashcards: Prisma.Element[]
  questions: Prisma.Element[]
  contentElements: Prisma.Element[]
  courseId: string
  connectStackToCourse?: boolean
  migrationIdOffset: number
}) {
  return {
    displayName: 'Stack displayname for group activity',
    description: 'Stack description for group activity.',
    order: 0,
    type: Prisma.ElementStackType.GROUP_ACTIVITY,
    options: {},
    elements: {
      createMany: {
        data: [
          ...questions
            .sort(
              (q1, q2) =>
                parseInt(q1.originalId ?? '-1') -
                parseInt(q2.originalId ?? '-1')
            )
            .map((el, ix) => ({
              migrationId: String(migrationIdOffset + 2 + ix),
              order: 2 + ix,
              type: Prisma.ElementInstanceType.GROUP_ACTIVITY,
              elementType: el.type,
              elementData: processElementData(el),
              options: {
                pointsMultiplier: ix / 3 > 0.9 ? 1 : 2, // first three questions get multiplier 2, the rest 1
                resetTimeDays: 5,
              },
              results: getInitialElementResults(el),
              anonymousResults: getInitialElementResults(el),
              instanceStatistics: getInitialInstanceStatistics(
                Prisma.ElementInstanceType.GROUP_ACTIVITY
              ),
              ownerId: el.ownerId,
              elementId: el.id,
            })),
          ...contentElements.slice(0, 2).map((el, ix) => ({
            migrationId: String(migrationIdOffset + questions.length + 2 + ix),
            order: questions.length + 2 + ix,
            type: Prisma.ElementInstanceType.GROUP_ACTIVITY,
            elementType: el.type,
            elementData: processElementData(el),
            options: {},
            results: getInitialElementResults(el),
            anonymousResults: getInitialElementResults(el),
            instanceStatistics: getInitialInstanceStatistics(
              Prisma.ElementInstanceType.GROUP_ACTIVITY
            ),
            ownerId: el.ownerId,
            elementId: el.id,
          })),
        ],
      },
    },
    course: connectStackToCourse
      ? {
          connect: {
            id: courseId,
          },
        }
      : undefined,
  }
}

export function prepareStackVariety({
  flashcards,
  questions,
  contentElements,
  stackType,
  elementInstanceType,
  courseId,
  connectToCourse = true,
  migrationIdOffset,
}: {
  flashcards: Prisma.Element[]
  questions: Prisma.Element[]
  contentElements: Prisma.Element[]
  stackType: Prisma.ElementStackType
  elementInstanceType: Prisma.ElementInstanceType
  courseId: string
  connectToCourse?: boolean
  migrationIdOffset: number
}) {
  return [
    // create stacks with one flashcard each
    ...flashcards.map((el, ix) => ({
      displayName: `Flashcard Stack ${ix + 1}`,
      description: 'This stack contains a single *flashcard*.',
      order: ix,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: [
            {
              migrationId: String(migrationIdOffset + ix),
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData: processElementData(el),
              options: { resetTimeDays: 7 },
              results: getInitialElementResults(el),
              anonymousResults: getInitialElementResults(el),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    })),
    // create one stack with all flashcards
    {
      displayName: `Flashcard Stack All`,
      description: 'This stack contains all the *flashcards*.',
      order: flashcards.length,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: flashcards.map((el, ix) => ({
            migrationId: String(migrationIdOffset + flashcards.length + ix),
            order: ix,
            type: elementInstanceType,
            elementType: el.type,
            elementData: processElementData(el),
            options: { resetTimeDays: 6 },
            results: getInitialElementResults(el),
            anonymousResults: getInitialElementResults(el),
            instanceStatistics:
              getInitialInstanceStatistics(elementInstanceType),
            ownerId: el.ownerId,
            elementId: el.id,
          })),
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    },
    // create stacks with questions
    ...questions.map((el, ix) => ({
      displayName: `Question Stack ${ix + 1}`,
      description: 'This stack contains a single *question*.',
      order: flashcards.length + ix + 1,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: [
            {
              migrationId: String(
                migrationIdOffset + 2 * flashcards.length + ix
              ),
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData: processElementData(el),
              options: { pointsMultiplier: 1, resetTimeDays: 5 },
              results: getInitialElementResults(el),
              anonymousResults: getInitialElementResults(el),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    })),
    // create one stack with all questions
    {
      displayName: `Question Stack All`,
      description: 'This stack contains all the *questions*.',
      order: flashcards.length + questions.length + 1,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: questions.map((el, ix) => ({
            migrationId: String(
              migrationIdOffset + 2 * flashcards.length + questions.length + ix
            ),
            order: ix,
            type: elementInstanceType,
            elementType: el.type,
            elementData: processElementData(el),
            options: { pointsMultiplier: 4, resetTimeDays: 8 },
            results: getInitialElementResults(el),
            anonymousResults: getInitialElementResults(el),
            instanceStatistics:
              getInitialInstanceStatistics(elementInstanceType),
            ownerId: el.ownerId,
            elementId: el.id,
          })),
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    },
    // create stacks with content elements
    ...contentElements.map((el, ix) => ({
      displayName: `Content Stack ${ix + 1}`,
      description: 'This stack contains a single *content element*.',
      order: flashcards.length + questions.length + ix + 2,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: [
            {
              migrationId: String(
                migrationIdOffset +
                  2 * flashcards.length +
                  2 * questions.length +
                  ix
              ),
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData: processElementData(el),
              options: { pointsMultiplier: 4, resetTimeDays: 7 },
              results: getInitialElementResults(el),
              anonymousResults: getInitialElementResults(el),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    })),
    // create two stacks with all content elements
    ...[0, 1].map((outer_ix) => ({
      displayName: `Content Stack All ${outer_ix + 1}`,
      description: 'This stack contains all the *content elements*.',
      order:
        flashcards.length +
        questions.length +
        contentElements.length +
        2 +
        outer_ix,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: contentElements.map((el, ix) => ({
            migrationId: String(
              migrationIdOffset +
                2 * flashcards.length +
                2 * questions.length +
                contentElements.length +
                outer_ix * contentElements.length +
                ix
            ),
            order: ix,
            type: elementInstanceType,
            elementType: el.type,
            elementData: processElementData(el),
            options: { pointsMultiplier: 2, resetTimeDays: 6 },
            results: getInitialElementResults(el),
            anonymousResults: getInitialElementResults(el),
            instanceStatistics:
              getInitialInstanceStatistics(elementInstanceType),
            ownerId: el.ownerId,
            elementId: el.id,
          })),
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    })),
    // create two stacks with one of each kind of elements
    ...[0, 1].map((ix) => ({
      displayName: `Mixed Stack ${ix + 1}`,
      description:
        'This stack contains one *flashcard*, one *question*, and one *content element*.',
      order:
        flashcards.length + questions.length + contentElements.length + 4 + ix,
      type: stackType,
      options: {},
      elements: {
        createMany: {
          data: [
            {
              migrationId: String(
                migrationIdOffset +
                  2 * flashcards.length +
                  2 * questions.length +
                  3 * contentElements.length +
                  ix * 5
              ),
              order: 0,
              type: elementInstanceType,
              elementType: flashcards[0]!.type,
              elementData: processElementData(flashcards[0]!),
              options: { resetTimeDays: 5 },
              results: getInitialElementResults(flashcards[0]!),
              anonymousResults: getInitialElementResults(flashcards[0]!),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: flashcards[0]!.ownerId,
              elementId: flashcards[0]!.id,
            },
            {
              migrationId: String(
                migrationIdOffset +
                  2 * flashcards.length +
                  2 * questions.length +
                  3 * contentElements.length +
                  ix * 5 +
                  1
              ),
              order: 1,
              type: elementInstanceType,
              elementType: questions[0]!.type,
              elementData: processElementData(questions[0]!),
              options: { pointsMultiplier: 3, resetTimeDays: 6 },
              results: getInitialElementResults(questions[0]!),
              anonymousResults: getInitialElementResults(questions[0]!),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: questions[0]!.ownerId,
              elementId: questions[0]!.id,
            },
            {
              migrationId: String(
                migrationIdOffset +
                  2 * flashcards.length +
                  2 * questions.length +
                  3 * contentElements.length +
                  ix * 5 +
                  2
              ),
              order: 2,
              type: elementInstanceType,
              elementType: contentElements[0]!.type,
              elementData: processElementData(contentElements[0]!),
              options: {},
              results: getInitialElementResults(contentElements[0]!),
              anonymousResults: getInitialElementResults(contentElements[0]!),
              instanceStatistics:
                getInitialInstanceStatistics(elementInstanceType),
              ownerId: contentElements[0]!.ownerId,
              elementId: contentElements[0]!.id,
            },
          ],
        },
      },
      course: connectToCourse
        ? {
            connect: {
              id: courseId,
            },
          }
        : undefined,
    })),
  ]
}

export function prepareGroupActivityClues({
  activityId,
}: {
  activityId: string
}) {
  return [
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond1',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond1',
        displayName: 'Bond 1',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond2',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond2',
        displayName: 'Bond 2',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond3',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond3',
        displayName: 'Bond 3',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond4',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond4',
        displayName: 'Bond 4',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond5',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond5',
        displayName: 'Bond 5',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond6',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond6',
        displayName: 'Bond 6',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond7',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond7',
        displayName: 'Bond 7',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond8',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond8',
        displayName: 'Bond 8',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'bond9',
        },
      },
      create: {
        type: Prisma.ParameterType.STRING,
        name: 'bond9',
        displayName: 'Bond 9',
        value: 'Schweiz',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'numberClue1',
        },
      },
      create: {
        type: Prisma.ParameterType.NUMBER,
        name: 'numberClue1',
        displayName: 'Display number clue',
        value: '-100.25',
        unit: 'kg',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'numberClue2',
        },
      },
      create: {
        type: Prisma.ParameterType.NUMBER,
        name: 'numberClue2',
        displayName: 'Display number clue 2',
        value: '0',
        unit: '%',
      },
    },
    {
      where: {
        groupActivityId_name: {
          groupActivityId: activityId,
          name: 'numberClue3',
        },
      },
      create: {
        type: Prisma.ParameterType.NUMBER,
        name: 'numberClue3',
        displayName: 'Display number clue 3',
        value: '100.25',
        unit: 'm',
      },
    },
  ]
}

export function extractQuizInfo(doc: any, formulaTagId?: number) {
  const turndown = new Turndown()

  return {
    title: doc.box.title[0],
    description: doc.box.description[0],
    elements: doc.box.cards[0].card.map((card: any) => {
      const hasFormula =
        card.question[0].text[0].includes('\\(') ||
        card.answer[0].text[0].includes('\\(')

      if (hasFormula) {
        console.log(
          card.question[0].text[0].trim(),
          card.answer[0].text[0].trim()
        )
      }

      return {
        originalId: card['$'].id,
        name: `FC ${card['$'].id}`,
        content: turndown
          .turndown(card.question[0].text[0].trim())
          .replaceAll('\\(', '$$$$')
          .replaceAll('\\)', '$$$$')
          .replaceAll('\\$', '$$')
          .replaceAll('\\*', '*')
          .replaceAll('\\_', '_')
          .replaceAll('\\[', '[')
          .replaceAll('\\]', ']')
          .replaceAll('\\\\%', '\\%')
          .replaceAll('\\\\frac', '\\frac')
          .replaceAll('\\\\infty', '\\infty')
          .replaceAll('\\\\sigma', '\\sigma')
          .replaceAll('\\\\rho', '\\rho')
          .replaceAll('\\\\pi', '\\pi')
          .replaceAll('\\\\sum', '\\sum'),
        explanation: turndown
          .turndown(card.answer[0].text[0].trim())
          .replaceAll('\\(', '$$$$')
          .replaceAll('\\)', '$$$$')
          .replaceAll('\\$', '$$')
          .replaceAll('\\*', '*')
          .replaceAll('\\_', '_')
          .replaceAll('\\[', '[')
          .replaceAll('\\]', ']')
          .replaceAll('\\\\%', '\\%')
          .replaceAll('\\\\frac', '\\frac')
          .replaceAll('\\\\infty', '\\infty')
          .replaceAll('\\\\sigma', '\\sigma')
          .replaceAll('\\\\rho', '\\rho')
          .replaceAll('\\\\pi', '\\pi')
          .replaceAll('\\\\sum', '\\sum'),
        type: ElementType.FLASHCARD,
        options: {},
        tags: hasFormula
          ? {
              connect: {
                id: formulaTagId,
              },
            }
          : undefined,
      }
    }),
    // ... other practice quiz properties
  }
}

export async function processQuizInfo(fileName: string, formulaTagId?: number) {
  // @ts-ignore
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const xmlData = fs.readFileSync(path.join(__dirname, fileName), 'utf-8')

  const xmlDoc = await parseStringPromise(xmlData)

  const quizInfo = extractQuizInfo(xmlDoc, formulaTagId)

  return quizInfo
}

export async function prepareFlashcardsFromFile(
  prismaClient: Prisma.PrismaClient,
  fileName: string,
  userId: string,
  formulaTagId?: number
) {
  const quizInfo = await processQuizInfo(fileName, formulaTagId)

  const elementsFC = await Promise.allSettled(
    quizInfo.elements.map(async (data: any) => {
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

  if (
    elementsFC.some((el: PromiseSettledResult<any>) => el.status === 'rejected')
  ) {
    throw new Error('Failed to seed some flashcard elements')
  }

  const elements = elementsFC.map((el: any) => el.value)

  return elements
}

export async function prepareContentElements(
  prismaClient: Prisma.PrismaClient,
  content: Record<string, string>,
  userId: string
) {
  const elementsCE = await Promise.allSettled(
    Object.entries(content).map(async ([name, data]) => {
      const contentElement = await prismaClient.element.create({
        data: {
          name: name.trim(),
          content: data,
          options: {},
          type: ElementType.CONTENT,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
      })
      return contentElement
    })
  )

  if (elementsCE.some((el) => el.status === 'rejected')) {
    throw new Error('Failed to seed some content elements')
  }

  const elements = elementsCE.map((el: any) => el.value)

  return elements
}
