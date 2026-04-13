import * as Prisma from '@klicker-uzh/prisma/client'
import { ActivityType, type ElementOptionsCaseStudy } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import Turndown from 'turndown'
import { fileURLToPath } from 'url'
import { parseStringPromise } from 'xml2js'

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
  publicPreview?: boolean
  privatePreview?: boolean
  role?: Prisma.UserRole
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    catalystIndividual,
    catalystInstitutional,
    role: args.role ?? Prisma.UserRole.USER,
    firstLogin: false,
    logins: {
      create: {
        name: name.trim(),
        password: hashedPassword,
        scope: Prisma.UserLoginScope.FULL_ACCESS,
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
  isAssessmentEnabled?: boolean
  isCourseQARolloutEnabled?: boolean
  isCourseQAEnabled?: boolean
  isCourseQAAnonymousEnabled?: boolean
  ownerId: string
  color?: string
  pinCode?: number | null
  startDate: Date
  endDate: Date
  isGroupCreationEnabled: boolean
  groupDeadlineDate: Date
  maxGroupSize: number
  preferredGroupSize: number
  notificationEmail?: string
}) {
  const data = {
    ...args,
    authType: args.isAssessmentEnabled
      ? Prisma.CourseAuthType.SSO
      : Prisma.CourseAuthType.PIN,
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

  const availableAvatars = [
    '43de5cc3e88371b82515e365b61ca4f56b3fff76',
    'd6a8459b605f0caca2d132821e3c7213004a6a28',
    'f812911166dee1e4943bd781ed658845812d71be',
    '217ed4744160a52219711edc6636550d49b6d672',
  ]

  // with probability 60%, select one of the available avatars at random
  const avatar =
    Math.random() < 0.6
      ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
      : undefined

  const data = {
    ...args,
    avatar: avatar,
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
  originalId,
  name,
  type,
  ownerId,
  content,
  explanation,
  choices,
  options,
  collectionId,
  usedCollectionEntries,
}: {
  originalId: string
  name: string
  content: string
  explanation?: string
  type: Prisma.ElementType
  ownerId: string
  choices?: {
    value: string
    feedback?: string
    correct?: boolean
  }[]
  options?: any
  collectionId?: number
  usedCollectionEntries?: number[]
}) {
  const args = {
    originalId,
    name,
    content,
    explanation,
    type,
    owner: {
      connect: {
        id: ownerId,
      },
    },
  }

  if (choices) {
    const preparedChoices = choices.map((choice, ix) => ({
      ix,
      value: choice.value,
      feedback: choice.feedback,
      correct: choice.correct ?? false,
    }))

    return {
      ...args,
      options: {
        ...options,
        choices: preparedChoices,
      },
    }
  }

  if (
    typeof collectionId !== 'undefined' &&
    typeof usedCollectionEntries !== 'undefined'
  ) {
    return {
      ...args,
      options,
      answerCollection: {
        connect: {
          id: collectionId,
        },
      },
      answerCollectionItems: {
        connect: usedCollectionEntries.map((id) => ({
          id,
        })),
      },
    }
  }

  return {
    ...args,
    options: options ?? {},
  }
}

export function prepareGroupActivityStack({
  flashcards,
  questions,
  contentElements,
  courseId,
  connectStackToCourse = false,
}: {
  flashcards: Prisma.Element[]
  questions: Prisma.Element[]
  contentElements: Prisma.Element[]
  courseId: string
  connectStackToCourse?: boolean
}) {
  return {
    displayName: 'Stack displayname for group activity',
    description: 'Stack description for group activity.',
    order: 0,
    type: Prisma.ElementStackType.GROUP_ACTIVITY,
    elements: {
      create: [
        ...questions
          .sort(
            (q1, q2) =>
              parseInt(q1.originalId ?? '-1') - parseInt(q2.originalId ?? '-1')
          )
          .map((el, ix) => {
            const elementData = processElementData(el)
            const initialResults = getInitialInstanceResults(elementData)

            return {
              order: 2 + ix,
              type: Prisma.ElementInstanceType.GROUP_ACTIVITY,
              elementType: el.type,
              elementData,
              options: {
                basePoints: el.basePoints,
                pointsMultiplier: ix / 3 > 0.9 ? 1 : 2, // first three questions get multiplier 2, the rest 1
              },
              results: initialResults,
              anonymousResults: initialResults,
              instanceStatistics: {
                create: getInitialInstanceStatistics(
                  Prisma.ElementInstanceType.GROUP_ACTIVITY
                ),
              },
              ownerId: el.ownerId,
              elementId: el.id,
            }
          }),
        ...contentElements.slice(0, 2).map((el, ix) => {
          const elementData = processElementData(el)
          const initialResults = getInitialInstanceResults(elementData)

          return {
            order: questions.length + 2 + ix,
            type: Prisma.ElementInstanceType.GROUP_ACTIVITY,
            elementType: el.type,
            elementData,
            options: {},
            results: initialResults,
            anonymousResults: initialResults,
            instanceStatistics: {
              create: getInitialInstanceStatistics(
                Prisma.ElementInstanceType.GROUP_ACTIVITY
              ),
            },
            ownerId: el.ownerId,
            elementId: el.id,
          }
        }),
      ],
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

export function computeRandomCaseStudyDecisions({
  options,
}: {
  options: ElementOptionsCaseStudy
}) {
  return options.cases.map((caseItem) => {
    const itemResponses = options.items?.map((item) => {
      const criterionResponses = options.criteria.map((criterion) => ({
        criterionId: criterion.id,
        response:
          Math.round(
            (Math.random() * (criterion.max - criterion.min) + criterion.min) *
              100
          ) / 100,
      }))

      return {
        itemId: item.id,
        criterionResponses,
      }
    })

    return {
      caseId: caseItem.id,
      itemResponses,
    }
  })
}

export function prepareStackVariety({
  flashcards,
  questions,
  contentElements,
  stackType,
  elementInstanceType,
  courseId,
  connectToCourse = false,
  activityType,
}: {
  flashcards: Prisma.Element[]
  questions: Prisma.Element[]
  contentElements: Prisma.Element[]
  stackType: Prisma.ElementStackType
  elementInstanceType: Prisma.ElementInstanceType
  courseId: string
  connectToCourse?: boolean
  activityType: ActivityType
}) {
  return [
    // create stacks with one flashcard each
    ...flashcards.map((el, ix) => {
      const elementData = processElementData(el)
      const initialResults = getInitialInstanceResults(elementData)

      return {
        displayName: `Flashcard Stack ${ix + 1}`,
        description: 'This stack contains a single *flashcard*.',
        order: ix,
        type: stackType,
        elements: {
          create: [
            {
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData,
              options:
                activityType === ActivityType.PRACTICE_QUIZ
                  ? { resetTimeDays: 7 }
                  : {},
              results: initialResults,
              anonymousResults: initialResults,
              instanceStatistics: {
                create: getInitialInstanceStatistics(elementInstanceType),
              },
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
        course: connectToCourse
          ? {
              connect: {
                id: courseId,
              },
            }
          : undefined,
      }
    }),
    // create one stack with all flashcards
    {
      displayName: `Flashcard Stack All`,
      description: 'This stack contains all the *flashcards*.',
      order: flashcards.length,
      type: stackType,
      elements: {
        create: flashcards.map((el, ix) => {
          const elementData = processElementData(el)
          const initialResults = getInitialInstanceResults(elementData)

          return {
            order: ix,
            type: elementInstanceType,
            elementType: el.type,
            elementData,
            options:
              activityType === ActivityType.PRACTICE_QUIZ
                ? { resetTimeDays: 6 }
                : {},
            results: initialResults,
            anonymousResults: initialResults,
            instanceStatistics: {
              create: getInitialInstanceStatistics(elementInstanceType),
            },
            ownerId: el.ownerId,
            elementId: el.id,
          }
        }),
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
    ...questions.map((el, ix) => {
      const elementData = processElementData(el)
      const initialResults = getInitialInstanceResults(elementData)

      return {
        displayName: `Question Stack ${ix + 1}`,
        description: 'This stack contains a single *question*.',
        order: flashcards.length + ix + 1,
        type: stackType,
        elements: {
          create: [
            {
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData,
              options:
                activityType === ActivityType.PRACTICE_QUIZ
                  ? {
                      pointsMultiplier: 1,
                      resetTimeDays: 5,
                      basePoints: el.basePoints,
                    }
                  : { pointsMultiplier: 1, basePoints: el.basePoints },
              results: initialResults,
              anonymousResults: initialResults,
              instanceStatistics: {
                create: getInitialInstanceStatistics(elementInstanceType),
              },
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
        course: connectToCourse
          ? {
              connect: {
                id: courseId,
              },
            }
          : undefined,
      }
    }),
    // create one stack with all questions
    {
      displayName: `Question Stack All`,
      description: 'This stack contains all the *questions*.',
      order: flashcards.length + questions.length + 1,
      type: stackType,
      elements: {
        create: questions.map((el, ix) => ({
          order: ix,
          type: elementInstanceType,
          elementType: el.type,
          elementData: processElementData(el),
          options:
            activityType === ActivityType.PRACTICE_QUIZ
              ? {
                  pointsMultiplier: 4,
                  resetTimeDays: 8,
                  basePoints: el.basePoints,
                }
              : { pointsMultiplier: 4, basePoints: el.basePoints },
          results: getInitialInstanceResults(processElementData(el)),
          anonymousResults: getInitialInstanceResults(processElementData(el)),
          instanceStatistics: {
            create: getInitialInstanceStatistics(elementInstanceType),
          },
          ownerId: el.ownerId,
          elementId: el.id,
        })),
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
    ...contentElements.map((el, ix) => {
      const elementData = processElementData(el)
      const initialResults = getInitialInstanceResults(elementData)

      return {
        displayName: `Content Stack ${ix + 1}`,
        description: 'This stack contains a single *content element*.',
        order: flashcards.length + questions.length + ix + 2,
        type: stackType,
        elements: {
          create: [
            {
              order: ix,
              type: elementInstanceType,
              elementType: el.type,
              elementData,
              options:
                activityType === ActivityType.PRACTICE_QUIZ
                  ? { resetTimeDays: 7 }
                  : {},
              results: initialResults,
              anonymousResults: initialResults,
              instanceStatistics: {
                create: getInitialInstanceStatistics(elementInstanceType),
              },
              ownerId: el.ownerId,
              elementId: el.id,
            },
          ],
        },
        course: connectToCourse
          ? {
              connect: {
                id: courseId,
              },
            }
          : undefined,
      }
    }),
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
      elements: {
        create: contentElements.map((el, ix) => {
          const elementData = processElementData(el)
          const initialResults = getInitialInstanceResults(elementData)

          return {
            order: ix,
            type: elementInstanceType,
            elementType: el.type,
            elementData,
            options:
              activityType === ActivityType.PRACTICE_QUIZ
                ? { resetTimeDays: 6 }
                : {},
            results: initialResults,
            anonymousResults: initialResults,
            instanceStatistics: {
              create: getInitialInstanceStatistics(elementInstanceType),
            },
            ownerId: el.ownerId,
            elementId: el.id,
          }
        }),
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
      elements: {
        create: [
          {
            order: 0,
            type: elementInstanceType,
            elementType: flashcards[0]!.type,
            elementData: processElementData(flashcards[0]!),
            options:
              activityType === ActivityType.PRACTICE_QUIZ
                ? { resetTimeDays: 5 }
                : {},
            results: getInitialInstanceResults(
              processElementData(flashcards[0]!)
            ),
            anonymousResults: getInitialInstanceResults(
              processElementData(flashcards[0]!)
            ),
            instanceStatistics: {
              create: getInitialInstanceStatistics(elementInstanceType),
            },
            ownerId: flashcards[0]!.ownerId,
            elementId: flashcards[0]!.id,
          },
          {
            order: 1,
            type: elementInstanceType,
            elementType: questions[0]!.type,
            elementData: processElementData(questions[0]!),
            options:
              activityType === ActivityType.PRACTICE_QUIZ
                ? {
                    pointsMultiplier: 3,
                    resetTimeDays: 6,
                    basePoints: questions[0]?.basePoints,
                  }
                : { pointsMultiplier: 3, basePoints: questions[0]?.basePoints },
            results: getInitialInstanceResults(
              processElementData(questions[0]!)
            ),
            anonymousResults: getInitialInstanceResults(
              processElementData(questions[0]!)
            ),
            instanceStatistics: {
              create: getInitialInstanceStatistics(elementInstanceType),
            },
            ownerId: questions[0]!.ownerId,
            elementId: questions[0]!.id,
          },
          {
            order: 2,
            type: elementInstanceType,
            elementType: contentElements[0]!.type,
            elementData: processElementData(contentElements[0]!),
            options: {},
            results: getInitialInstanceResults(
              processElementData(contentElements[0]!)
            ),
            anonymousResults: getInitialInstanceResults(
              processElementData(contentElements[0]!)
            ),
            instanceStatistics: {
              create: getInitialInstanceStatistics(elementInstanceType),
            },
            ownerId: contentElements[0]!.ownerId,
            elementId: contentElements[0]!.id,
          },
        ],
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

export function extractQuizInfo(
  doc: any,
  formulaTagId?: number,
  courseTagId?: number
) {
  const turndown = new Turndown()

  return {
    title: doc.box.title[0],
    description: doc.box.description[0],
    elements: doc.box.cards[0].card.map((card: any) => {
      const hasFormula =
        card.question[0].text[0].includes('\\(') ||
        card.answer[0].text[0].includes('\\(')

      if (hasFormula) {
        // console.log(
        //   card.question[0].text[0].trim(),
        //   card.answer[0].text[0].trim()
        // )
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
          .replaceAll('\\\\', '\\'),
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
          .replaceAll('\\\\', '\\'),
        type: Prisma.ElementType.FLASHCARD,
        options: {},
        tags:
          (hasFormula && formulaTagId) || courseTagId
            ? {
                connect: [
                  ...(hasFormula && formulaTagId ? [{ id: formulaTagId }] : []),
                  ...(courseTagId ? [{ id: courseTagId }] : []),
                ],
              }
            : undefined,
      }
    }),
    // ... other practice quiz properties
  }
}

export async function processQuizInfo(
  fileName: string,
  formulaTagId?: number,
  courseTagId?: number
) {
  // @ts-ignore
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const xmlData = fs.readFileSync(path.join(__dirname, fileName), 'utf-8')

  const xmlDoc = await parseStringPromise(xmlData)

  const quizInfo = extractQuizInfo(xmlDoc, formulaTagId, courseTagId)

  return quizInfo
}

export async function prepareFlashcardsFromFile(
  prismaClient: Prisma.PrismaClient,
  fileName: string,
  userId: string,
  formulaTagId?: number,
  courseTagId?: number
) {
  const quizInfo = await processQuizInfo(fileName, formulaTagId, courseTagId)
  const elementsFC = await Promise.allSettled(
    quizInfo.elements.map(async (data: any) => {
      // check if an element with the same originalId already exists
      const existingElement = await prismaClient.element.findFirst({
        where: {
          name: data.name,
          ownerId: userId,
          isDeleted: false,
        },
      })

      if (existingElement) {
        await prismaClient.element.update({
          where: { id: existingElement.id },
          data: {
            status: Prisma.ElementStatus.REVIEW,
            tags: data.tags,
            content:
              data.content && existingElement.content !== data.content
                ? data.content
                : undefined,
            explanation:
              data.explanation &&
              existingElement.explanation !== data.explanation
                ? data.explanation
                : undefined,
          },
        })

        if (existingElement.explanation !== data.explanation) {
          console.log('EXPLANATION CHANGED FOR FLASHCARD: ', data.name)
          console.log('Old explanation: ', existingElement.explanation)
          console.log('New explanation: ', data.explanation)
        }

        if (existingElement.content !== data.content) {
          console.log('CONTENT CHANGED FOR FLASHCARD: ', data.name)
          console.log('Old content: ', existingElement.content)
          console.log('New content: ', data.content)
        }

        return existingElement
      }

      const flashcard = await prismaClient.element.create({
        data: {
          ...data,
          status: Prisma.ElementStatus.REVIEW,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
      })

      await recomputeDerivedPermissions(
        {
          elementId: flashcard.id,
          userId: flashcard.ownerId,
        },
        prismaClient
      )

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
          type: Prisma.ElementType.CONTENT,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
      })

      await recomputeDerivedPermissions(
        {
          elementId: contentElement.id,
          userId: contentElement.ownerId,
        },
        prismaClient
      )

      return contentElement
    })
  )

  if (elementsCE.some((el) => el.status === 'rejected')) {
    throw new Error('Failed to seed some content elements')
  }

  const elements = elementsCE.map((el: any) => el.value)

  return elements
}
