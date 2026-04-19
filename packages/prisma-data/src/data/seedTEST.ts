import { prisma } from '@klicker-uzh/prisma'
import * as Prisma from '@klicker-uzh/prisma/client'
import { ActivityType, type ElementOptionsCaseStudy } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  MISSING_CATALOG_COLLECTION_ID,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import generatePassword from 'generate-password'
import {
  COURSE_ID_TEST4 as COURSE_ID_ASSESSMENT,
  COURSE_ID_CALENDAR,
  COURSE_ID_TEST,
  COURSE_ID_TEST2,
  COURSE_ID_TEST3,
  COURSE_ID_TEST5,
  PARTICIPANT_IDS,
  USER_ID_TEST,
} from './constants.js'
import * as DATA_TEST from './data/TEST.js'
import {
  computeRandomCaseStudyDecisions,
  prepareContentElements,
  prepareCourse,
  prepareFlashcardsFromFile,
  prepareGroupActivityClues,
  prepareGroupActivityStack,
  prepareParticipant,
  prepareQuestion,
  prepareStackVariety,
} from './helpers.js'
import { seedAccounts } from './seedAccounts.js'
import { seedAchievements } from './seedAchievements.js'
import { seedChatbots } from './seedChatbots.js'
import { seedCompetencyTree } from './seedCompetencyTree.js'
import { seedEmailTemplates } from './seedEmailTemplates.js'
import { seedLevels } from './seedLevels.js'
import {
  seedChatbotMCPConfigurations,
  seedMCPServers,
} from './seedMCPServers.js'
import { seedUsers } from './seedUsers.js'

// Re-export for backwards compat; canonical source is `./constants.ts`.
export { PARTICIPANT_IDS }

// uuids for 14 participant groups
export const PARTICIPANT_GROUP_IDS = [
  '9c4940c1-87ca-47a7-afc4-cd85656df3e7',
  '4fc5c849-5a2b-437c-a6fd-91daac4e556a',
  '0de95dcb-1802-47f7-9fb9-01085d1d2281',
  '6f4ae38f-5866-4d24-8844-cd380998591c',
  'e91fe13f-4394-496f-b12f-993f9a1a8dba',
  'ac6a7361-f71e-4fcd-821f-8904954af90f',
  'f30a99f8-3d66-4f28-8aaf-af64b392de05',
  'e5ddf45a-89e3-466a-9d17-e60354470925',
  'fb1c3685-f51e-4585-8444-dbbe2ddb76a4',
  'f2f843c6-a35e-46d7-9574-902e1d134d6c',
  'd822a233-c6d4-4cb5-a7b8-4a265d7ffaa0',
  '7d9571fd-fdf4-4392-8293-768539896c09',
  '278057ff-f1c2-49a0-9ab1-bcbc4c6473b7',
  '11c06c89-0cb4-4d8e-b052-b711f327b8c4',
]

async function seedTest(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  await seedLevels(prisma)
  await seedAchievements(prisma)
  await seedUsers(prisma)
  await seedAccounts(prisma)
  await seedCompetencyTree(prisma)
  await seedEmailTemplates(prisma)

  // seed catalog collection for objects that are not assigned to any custom catalog
  await prisma.catalogCollection.upsert({
    where: {
      id: MISSING_CATALOG_COLLECTION_ID,
    },
    create: {
      id: MISSING_CATALOG_COLLECTION_ID,
      name: '',
      access: Prisma.ObjectAccess.PUBLIC,
    },
    update: { name: '', access: Prisma.ObjectAccess.PUBLIC },
  })

  // seed answer collections
  const answerCollections: (Prisma.AnswerCollection & {
    entries: Prisma.AnswerCollectionEntry[]
  })[] = []
  for (const data of DATA_TEST.ANSWER_COLLECTIONS) {
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: data.name,
        description: data.description,
        owner: {
          connect: {
            id: USER_ID_TEST,
          },
        },
        entries: {
          create: data.entries,
        },
      },
      include: {
        entries: true,
      },
    })

    await recomputeDerivedPermissions(
      {
        answerCollectionId: (answerCollection as any).id,
        userId: USER_ID_TEST,
      },
      prisma
    )

    answerCollections.push(answerCollection)
  }

  // seed two different catalog colllections, one public, one restricted
  const publicCatalogCollection = await prisma.catalogCollection.upsert({
    where: {
      id: DATA_TEST.PUBLIC_CATALOG_COLLECTION_ID,
    },
    create: {
      id: DATA_TEST.PUBLIC_CATALOG_COLLECTION_ID,
      name: 'Public Catalog Collection',
      access: Prisma.ObjectAccess.PUBLIC,
      ownerId: USER_ID_TEST,
    },
    update: {
      name: 'Public Catalog Collection',
      access: Prisma.ObjectAccess.PUBLIC,
    },
  })
  const restrictedCatalogCollection = await prisma.catalogCollection.upsert({
    where: {
      id: DATA_TEST.RESTRICTED_CATALOG_COLLECTION_ID,
    },
    create: {
      id: DATA_TEST.RESTRICTED_CATALOG_COLLECTION_ID,
      name: 'Restricted Catalog Collection',
      access: Prisma.ObjectAccess.RESTRICTED,
      ownerId: USER_ID_TEST,
    },
    update: {
      name: 'Restricted Catalog Collection',
      access: Prisma.ObjectAccess.RESTRICTED,
    },
  })

  // recompute derived permissions for the catalog collections
  await recomputeDerivedPermissions(
    { catalogCollectionId: publicCatalogCollection.id, userId: USER_ID_TEST },
    prisma
  )
  await recomputeDerivedPermissions(
    {
      catalogCollectionId: restrictedCatalogCollection.id,
      userId: USER_ID_TEST,
    },
    prisma
  )

  // assign answer collections to catalog collections, if defined in relation
  await Promise.all(
    DATA_TEST.CATALOG_ASSIGNMENTS.map(async (data) => {
      const collection = answerCollections.find(
        (ac) => ac.name === data.answerCollectionName
      )
      return prisma.catalogCollectionAssignment.upsert({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: collection!.id,
            catalogCollectionId: data.catalogCollectionId,
          },
        },
        create: {
          access: data.access,
          answerCollection: {
            connect: {
              id: collection!.id,
            },
          },
          catalogCollection: {
            connect: {
              id: data.catalogCollectionId,
            },
          },
        },
        update: {},
      })
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_TEST,
      name: 'Testkurs',
      displayName: 'Testkurs',
      description: 'Das ist ein Testkurs. Hier wird getestet. Viel Spass!',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#016272',
      pinCode: 123456789,
      startDate: new Date(`2019-01-01T00:00`),
      endDate: new Date(`2055-01-01T23:59`),
      isGroupCreationEnabled: true,
      groupDeadlineDate: new Date('2019-12-01T00:01'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_TEST2,
      name: 'Testkurs 2',
      displayName: 'Testkurs 2',
      description: 'Das ist ein Testkurs. Hier wird getestet. Abrakadabra!',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#ff0000',
      pinCode: 987654321,
      startDate: new Date('2023-01-01T00:00'),
      endDate: new Date('2024-01-01T23:59'),
      isGroupCreationEnabled: true,
      groupDeadlineDate: new Date('2024-01-01T00:01'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_TEST3,
      name: 'Non-Gamified Course',
      displayName: 'Non-Gamified Course',
      description: 'This is a course without gamification.',
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#166b16',
      pinCode: 482748273,
      startDate: new Date('2023-01-01T00:00'),
      endDate: new Date('2030-01-01T23:59'),
      isGroupCreationEnabled: false,
      groupDeadlineDate: new Date('2025-01-01T00:01'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_ASSESSMENT,
      name: 'Assessment Course',
      displayName: 'Assessment Course',
      description:
        'This is a course with assessment enabled (gamification disabled).',
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      ownerId: USER_ID_TEST,
      color: '#166b16',
      pinCode: null,
      startDate: new Date('2023-01-01T00:00'),
      endDate: new Date('2030-01-01T23:59'),
      isGroupCreationEnabled: false,
      groupDeadlineDate: new Date('2025-01-01T00:01'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_TEST5,
      name: 'Gamified Assessment Course',
      displayName: 'Gamified Assessment Course',
      description:
        'This is a course with assessment enabled (gamification enabled).',
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      ownerId: USER_ID_TEST,
      color: '#166b16',
      pinCode: null,
      startDate: new Date('2023-01-01T00:00'),
      endDate: new Date('2030-01-01T23:59'),
      isGroupCreationEnabled: false,
      groupDeadlineDate: new Date('2025-01-01T00:01'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_CALENDAR,
      name: 'Testkurs Calendar View',
      displayName: 'Testkurs Calendar View',
      description:
        'An advanced course exploring digital transformation, data analytics, AI, and innovation strategies. Features comprehensive calendar-based learning with diverse activity schedules.',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#8B5CF6',
      pinCode: 742638291,
      startDate: new Date('2025-07-01T00:00'),
      endDate: new Date('2025-08-31T23:59'),
      isGroupCreationEnabled: true,
      groupDeadlineDate: new Date('2025-07-15T23:59'),
      maxGroupSize: 4,
      preferredGroupSize: 3,
      notificationEmail: 'notifications@df.uzh.ch',
    })
  )

  await seedChatbots(prisma)
  const mcpServers = await seedMCPServers(prisma)
  await seedChatbotMCPConfigurations(prisma, mcpServers)

  const questionsTest: (Prisma.Element & {
    answerCollection?:
      | (Prisma.AnswerCollection & { entries: Prisma.AnswerCollectionEntry[] })
      | null
    answerCollectionItems?: Prisma.AnswerCollectionEntry[] | null
  })[] = []
  for (const data of DATA_TEST.QUESTIONS) {
    let collectionId: number | undefined = undefined
    let usedCollectionEntries: number[] = []
    let caseStudyCasesWithSolution: ElementOptionsCaseStudy['cases'] | undefined

    if (data.collectionName && data.answerCollectionItems) {
      const collection = answerCollections.find(
        (ac) => ac.name === data.collectionName
      )

      if (!collection) {
        throw new Error(
          `Answer collection with name ${data.collectionName} not found`
        )
      }

      collectionId = collection.id
      usedCollectionEntries = data.answerCollectionItems.map((solValue) => {
        const entry = collection.entries.find(
          (entry) => entry.value === solValue
        )

        if (typeof entry === 'undefined') {
          throw new Error(
            `Option with value ${solValue} not found in answer collection ${collection.name}`
          )
        }

        return entry.id
      })

      // if sample solutions are activated for the case study, map the corresponding items to respective ids
      if (
        data.type === Prisma.ElementType.CASE_STUDY &&
        data.options.hasSampleSolution
      ) {
        // verify that cases and solutions therein are given
        if (!data.options.cases || data.options.cases.length === 0) {
          throw new Error('Cases for case study need to be defined')
        }

        const cases = data.options.cases
        if (cases.some((caseItem) => !('solutions' in caseItem))) {
          throw new Error(
            'Cases need to have solutions defined, if sample solutions are activated'
          )
        }

        // map the items in the solutions to their respective ids
        caseStudyCasesWithSolution = cases.map((caseItem) => {
          if (!('solutions' in caseItem) || !caseItem.solutions) {
            throw new Error(
              'Solutions need to be defined for case study cases with sample solution activated'
            )
          }

          return {
            ...caseItem,
            solutions: caseItem.solutions.map((solution) => {
              const entry = collection.entries.find(
                (entry) => entry.value === solution.item
              )

              if (typeof entry === 'undefined') {
                throw new Error(
                  `Item with value ${solution.item} not found in answer collection ${collection.name}`
                )
              }

              return {
                itemId: entry.id,
                criteriaSolutions: solution.criteriaSolutions,
              }
            }),
          }
        })
      }
    }

    // check if an element with the same original id already exists -> return early
    const existingElement = await prisma.element.findFirst({
      where: {
        originalId: data.originalId,
      },
    })

    if (existingElement) {
      questionsTest.push(existingElement)
      continue
    }

    const dataCreate = prepareQuestion({
      ownerId: USER_ID_TEST,
      ...data,
      options: caseStudyCasesWithSolution
        ? {
            ...data.options,
            cases: caseStudyCasesWithSolution,
          }
        : data.options,
      collectionId,
      usedCollectionEntries,
    })
    const newElement = await prisma.element.create({
      data: dataCreate,
      include: {
        answerCollection: {
          include: {
            entries: true,
          },
        },
        answerCollectionItems: true,
      },
    })

    await recomputeDerivedPermissions(
      { elementId: newElement.id, userId: USER_ID_TEST },
      prisma
    )

    // add the processed question to our array
    questionsTest.push(newElement)
  }

  const answerCollectionItems = answerCollections.reduce<
    { id: number; name: string }[]
  >((acc, collection) => {
    acc.push(
      ...collection.entries.map((entry) => ({
        id: entry.id,
        name: entry.value,
      }))
    )

    return acc
  }, [])

  const startedAtLiveQuiz = new Date()
  const endedAtLiveQuiz = new Date(startedAtLiveQuiz.getTime() + 60 * 60 * 1000)
  for (const data of DATA_TEST.LIVE_QUIZZES) {
    const isEnded = data.status == Prisma.PublicationStatus.ENDED

    const liveQuiz = await prisma.liveQuiz.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        isModerationEnabled: data.isModerationEnabled,
        isLiveQAEnabled: data.isLiveQAEnabled,
        isConfusionFeedbackEnabled: data.isConfusionFeedbackEnabled,
        isGamificationEnabled: data.isGamificationEnabled,
        isAssessmentEnabled: data.isAssessmentEnabled,
        status: data.status ?? Prisma.PublicationStatus.DRAFT,
        availableFrom: data.availableFrom,
        pointsMultiplier: data.pointsMultiplier,
        defaultPoints: data.defaultPoints,
        defaultCorrectPoints: data.defaultCorrectPoints,
        maxBonusPoints: data.maxBonusPoints,
        timeToZeroBonus: data.timeToZeroBonus,
        ...(isEnded
          ? {
              startedAt: startedAtLiveQuiz,
              finishedAt: endedAtLiveQuiz,
            }
          : {}),
        blocks: {
          create: data.blocks.map((block, ix) => ({
            order: ix,
            timeLimit: block.timeLimit,
            ...(isEnded
              ? {
                  startedAt: startedAtLiveQuiz,
                  closedAt: endedAtLiveQuiz,
                  status: Prisma.ElementBlockStatus.EXECUTED,
                }
              : {}),
            elements: {
              create: block.questions.map((elementId, elementIx) => {
                const el = questionsTest.find(
                  (el) => el.originalId === String(elementId)
                )
                if (typeof el === 'undefined') {
                  throw new Error(
                    `Element with id ${elementId} not found in questionsTest`
                  )
                }

                const elementData = processElementData(el)
                const initialResults = getInitialInstanceResults(elementData)
                const anonymousResultIndex = String(
                  elementId
                ) as DATA_TEST.QUESTION_ID_TYPE
                const anonymousResults = isEnded
                  ? data.anonymousResults[anonymousResultIndex]
                  : initialResults
                return {
                  order: elementIx,
                  type: Prisma.ElementInstanceType.LIVE_QUIZ,
                  elementType: el.type,
                  elementData,
                  options: {
                    basePoints: el.basePoints,
                    pointsMultiplier:
                      (data.pointsMultiplier ?? 1) * el.pointsMultiplier,
                  },
                  results: initialResults,
                  anonymousResults: anonymousResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      Prisma.ElementInstanceType.LIVE_QUIZ
                    ),
                  },
                  element: { connect: { id: el.id } },
                  owner: { connect: { id: USER_ID_TEST } },
                }
              }),
            },
          })),
        },
        templateInfo: data.template
          ? {
              create: {
                ...data.template,
                answerCollections: {
                  connect: data.template.answerCollections.map(
                    (collection) => ({
                      id: answerCollections.find(
                        (ac) => ac.name === collection
                      )!.id,
                    })
                  ),
                },
                answerCollectionItems: {
                  connect: data.template.answerCollectionItems.map((item) => ({
                    id: answerCollectionItems.find(
                      (acItem) => acItem.name === item
                    )!.id,
                  })),
                },
              },
            }
          : undefined,
        owner: { connect: { id: USER_ID_TEST } },
        course: { connect: { id: COURSE_ID_TEST } },
      },
      update: {},
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    // recompute derived permissions for the live quiz
    await recomputeDerivedPermissions(
      {
        liveQuizId: liveQuiz.id,
        userId: USER_ID_TEST,
      },
      prisma
    )

    // create a catalog collection assignment if the live quiz is in template status
    if (data.status === Prisma.PublicationStatus.TEMPLATE) {
      await prisma.catalogCollectionAssignment.upsert({
        where: {
          liveQuizId_catalogCollectionId: {
            liveQuizId: liveQuiz.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
        create: {
          access: Prisma.ObjectAccess.PUBLIC,
          liveQuiz: { connect: { id: liveQuiz.id } },
          catalogCollection: { connect: { id: MISSING_CATALOG_COLLECTION_ID } },
        },
        update: {},
      })
    }
  }

  // create calendar course live quizzes with diverse scheduling patterns
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentDate = today

  const calendarLiveQuizzes = [
    {
      id: 'bdde8a26-1dca-4a30-93ab-accd52849cef',
      name: 'Calendar Live Quiz 1',
      displayName: 'Calendar Live Quiz 1',
      description:
        'Introduction to digital transformation concepts and methodologies.',
      status: Prisma.PublicationStatus.DRAFT,
      pointsMultiplier: 2,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
    },
    {
      id: '3ce1b871-809a-4f7a-b3de-e238a4e6e3bc',
      name: 'Calendar Live Quiz 2',
      displayName: 'Calendar Live Quiz 2',
      description:
        'Comprehensive exploration of data analytics techniques and tools.',
      status: Prisma.PublicationStatus.DRAFT,
      pointsMultiplier: 3,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
    },
  ]

  const assessmentLiveQuizzes = [
    {
      id: '0d4b7c3d-0230-4f7b-b95a-319891171295',
      name: 'Assessment Live Quiz 1',
      displayName: 'Assessment Live Quiz 1',
      description:
        'Introduction to digital transformation concepts and methodologies.',
      status: Prisma.PublicationStatus.DRAFT,
      pointsMultiplier: 2,
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      pinCode: generatePassword.generate({
        uppercase: true,
        lowercase: false,
        numbers: true,
        symbols: false,
        length: 6,
      }),
    },
    {
      id: '5840b720-a5fd-4f73-9081-22c06d0c4069',
      name: 'Assessment Live Quiz 2',
      displayName: 'Assessment Live Quiz 2',
      description:
        'Comprehensive exploration of data analytics techniques and tools.',
      status: Prisma.PublicationStatus.DRAFT,
      pointsMultiplier: 3,
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      pinCode: generatePassword.generate({
        uppercase: true,
        lowercase: false,
        numbers: true,
        symbols: false,
        length: 6,
      }),
    },
  ]

  for (const quizData of [
    ...calendarLiveQuizzes.map((quiz) => ({
      courseId: COURSE_ID_CALENDAR,
      ...quiz,
    })),
    ...assessmentLiveQuizzes.map((quiz) => ({
      courseId: COURSE_ID_ASSESSMENT,
      ...quiz,
    })),
  ]) {
    const liveQuiz = await prisma.liveQuiz.upsert({
      where: { id: quizData.id },
      create: {
        ...quizData,
        courseId: undefined,
        isModerationEnabled: true,
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: true,
        defaultPoints: 25,
        defaultCorrectPoints: 50,
        maxBonusPoints: 20,
        timeToZeroBonus: 180,
        blocks: {
          create: [
            {
              order: 0,
              timeLimit: 120,
              elements: {
                create: [
                  {
                    order: 0,
                    type: Prisma.ElementInstanceType.LIVE_QUIZ,
                    elementType: questionsTest[0]!.type,
                    elementData: processElementData(questionsTest[0]!),
                    options: {
                      basePoints: true,
                      pointsMultiplier: quizData.pointsMultiplier,
                    },
                    results: getInitialInstanceResults(
                      processElementData(questionsTest[0]!)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(questionsTest[0]!)
                    ),
                    instanceStatistics: {
                      create: getInitialInstanceStatistics(
                        Prisma.ElementInstanceType.LIVE_QUIZ
                      ),
                    },
                    element: { connect: { id: questionsTest[0]!.id } },
                    owner: { connect: { id: USER_ID_TEST } },
                  },
                ],
              },
            },
          ],
        },
        course: { connect: { id: quizData.courseId } },
        owner: { connect: { id: USER_ID_TEST } },
      },
      update: {},
    })

    // recompute derived permissions for the live quiz
    await recomputeDerivedPermissions(
      {
        liveQuizId: liveQuiz.id,
        userId: USER_ID_TEST,
      },
      prisma
    )
  }

  // create participants
  await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id,
          password: 'abcdabcd',
          username: `testuser${ix + 1}`,
          courseIds: [COURSE_ID_TEST],
        })
      )
    })
  )

  // create participations for all the first 30 participants
  await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participation.upsert({
        where: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId: id,
          },
        },
        create: {
          isActive: true,
          course: {
            connect: {
              id: COURSE_ID_TEST,
            },
          },
          participant: {
            connect: {
              id: id,
            },
          },
        },
        update: {
          isActive: true,
        },
      })
    })
  )

  // add participants 30 to 35 to single groups
  const PARTICIPANT_GROUP_IDS_SINGLE = [
    'af6758da-8667-43a3-9e7f-02fc1a441261',
    '6f7f65bb-84aa-4ec4-b52e-46b36d1c302b',
    'c07d7f8e-9299-4809-aed7-331cae09f347',
    '38de3f21-abb8-4982-a51d-e654f62ebe34',
    'd9f23367-32b9-45ba-9bd6-06b6d96a5829',
  ]
  await Promise.all(
    PARTICIPANT_GROUP_IDS_SINGLE.map(async (id, ix) => {
      const code = 100000 + Math.floor(Math.random() * 900000)

      return prisma.participantGroup.upsert({
        where: {
          id,
        },
        create: {
          id,
          name: `Single Gruppe ${ix + 1}`,
          code: code,
          course: { connect: { id: COURSE_ID_TEST } },
          participants: {
            connect: [
              {
                id: PARTICIPANT_IDS[ix + 29],
              },
            ],
          },
          averageMemberScore: Math.round(ix * 100 + 500),
        },
        update: {
          name: `Single Gruppe ${ix + 1}`,
          code: code,
        },
      })
    })
  )

  // add the participants 30-50 to the random assignment pool
  await Promise.all(
    PARTICIPANT_IDS.slice(35).map(async (id) => {
      return prisma.groupAssignmentPoolEntry.upsert({
        where: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId: id,
          },
        },
        create: {
          course: {
            connect: {
              id: COURSE_ID_TEST,
            },
          },
          participant: {
            connect: {
              id: id,
            },
          },
        },
        update: {},
      })
    })
  )

  // create leaderboard entries for the top 15
  await Promise.all(
    PARTICIPANT_IDS.slice(0, 15).map(async (id, ix) => {
      return prisma.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            courseId: COURSE_ID_TEST,
            participantId: id,
          },
        },
        create: {
          type: 'COURSE',
          score: ix * 100 + 100,
          participant: {
            connect: {
              id: id,
            },
          },
          course: {
            connect: {
              id: COURSE_ID_TEST,
            },
          },
          participation: {
            connect: {
              courseId_participantId: {
                courseId: COURSE_ID_TEST,
                participantId: id,
              },
            },
          },
        },
        update: {},
      })
    })
  )

  // create participant groups
  await Promise.all(
    PARTICIPANT_GROUP_IDS.map(async (id, ix) => {
      const code = 100000 + Math.floor(Math.random() * 900000)

      return prisma.participantGroup.upsert({
        where: {
          id,
        },
        create: {
          id,
          name: `Gruppe ${ix + 1}`,
          code: code,
          course: { connect: { id: COURSE_ID_TEST } },
          participants: {
            connect: [
              {
                id: PARTICIPANT_IDS[ix],
              },
              {
                id: PARTICIPANT_IDS[ix + PARTICIPANT_GROUP_IDS.length],
              },
            ],
          },
          averageMemberScore: Math.round(ix * 100 + 500),
        },
        update: {
          name: `Gruppe ${ix + 1}`,
          code: code,
        },
      })
    })
  )

  await Promise.all(
    [
      '908f84d0-fd32-4a99-8a9f-b4793288234d',
      'ec8385db-e951-47dc-9e86-e215b7e4c501',
    ].map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id,
          password: 'abcdabcd',
          username: `testuser${ix + PARTICIPANT_IDS.length + 1}`,
          courseIds: [],
        })
      )
    })
  )

  await Promise.all(
    PARTICIPANT_IDS.map(async (participantId) => {
      await prisma.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: participantId,
            achievementId: DATA_TEST.AchievementIds.Explorer,
          },
        },
        create: {
          participant: {
            connect: {
              id: participantId,
            },
          },
          achievement: {
            connect: {
              id: DATA_TEST.AchievementIds.Explorer,
            },
          },
          achievedAt: new Date(),
          achievedCount: 1,
        },
        update: {},
      })
    })
  )

  const awardedAchievements = [
    DATA_TEST.AchievementIds['Busy Bee'],
    DATA_TEST.AchievementIds['Dream Team'],
    DATA_TEST.AchievementIds['Team Spirit'],
    DATA_TEST.AchievementIds.Fearless,
  ]
  await Promise.all(
    awardedAchievements.map(async (achievementId) => {
      await prisma.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: PARTICIPANT_IDS[0]!,
            achievementId: achievementId,
          },
        },
        create: {
          participant: { connect: { id: PARTICIPANT_IDS[0] } },
          achievement: { connect: { id: achievementId } },
          achievedAt: new Date(),
          achievedCount: 1,
        },
        update: {},
      })
    })
  )

  // seed practice quiz
  const flashcards = (await prepareFlashcardsFromFile(
    prisma,
    'data/FC_Modul_1.xml',
    USER_ID_TEST
  )) as Prisma.Element[]

  // seed content elements
  const contentElements = (await prepareContentElements(
    prisma,
    {
      'Dummy Content Element 1':
        "# Introduction to Mathematical Concepts\n\nLorem ipsum dolor sit amet, **consectetur adipiscing elit**. Sed vitae nisl euismod, aliquam nunc vita. Mathematics forms the foundation of modern science and engineering, enabling us to model and understand the world around us. In this section, we will explore fundamental concepts that are essential for advanced study.\n\n## Key Concepts\n\n* Differential equations: The study of functions and their derivatives, crucial for modeling change over time\n* Linear algebra: The study of vector spaces and linear mappings between these spaces, providing tools for solving systems of linear equations\n* Statistical analysis: Methods for collecting, analyzing, interpreting, and presenting empirical data\n* Probability theory: Mathematical framework for quantifying uncertainty and analyzing random phenomena\n* Calculus: The mathematical study of continuous change, providing methods for optimization and approximation\n* Number theory: The branch of pure mathematics concerned with properties of integers and related structures\n\nThe relationship between force and acceleration is given by $$F = ma$$, which is Newton's second law of motion. This principle is fundamental to classical mechanics and forms the basis for understanding dynamic systems throughout physics and engineering applications.\n\nFor the wave equation, we have:\n\n$$ \n\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\frac{\\partial^2 u}{\\partial x^2} \n$$\n\nThis partial differential equation describes the propagation of waves, such as sound waves, light waves, and water waves. The parameter c represents the wave's propagation speed, which depends on the medium through which the wave travels.\n\n### Practical Applications\n\n1. Machine learning algorithms: Mathematical models that enable computers to learn from data without explicit programming\n2. Financial modeling: Mathematical representations of financial systems used for risk assessment and investment strategies\n3. Physics simulations: Numerical methods for approximating physical phenomena in virtual environments\n4. Engineering design: Application of mathematical principles to solve practical problems and optimize solutions\n5. Cryptography: The use of mathematical techniques to secure communications and protect information\n6. Optimization problems: Finding the best solution from all feasible solutions in various fields like logistics and resource allocation",

      'Dummy Content Element 2':
        '## Data Analysis Techniques\n\n> The analysis of data requires both *theoretical knowledge* and **practical skills**. Success in this field depends on combining rigorous statistical methods with domain expertise and creative problem-solving approaches.\n\nConsider the following steps in a data analysis workflow:\n\n1. Data collection: Gathering information from various sources including surveys, sensors, databases, and APIs\n2. Data cleaning: Preparing the data for analysis by addressing quality issues\n   * Handling missing values: Imputation techniques or removal strategies for incomplete records\n   * Removing duplicates: Identifying and eliminating redundant observations to prevent bias\n   * Addressing outliers: Detecting and managing extreme values that might distort analysis\n   * Standardizing formats: Ensuring consistency across different data sources and variables\n   * Correcting errors: Identifying and fixing inaccuracies in the dataset\n3. Exploratory data analysis: Investigating data patterns and relationships through visualization and summary statistics\n4. Statistical modeling: Applying mathematical frameworks to understand relationships and make predictions\n5. Interpretation of results: Drawing meaningful conclusions and communicating insights effectively\n6. Deployment and monitoring: Implementing findings into operational systems and tracking performance over time\n\nThe standard deviation is calculated using the formula $$\\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\mu)^2}$$ where σ is the standard deviation, N is the number of data points, x_i represents each individual value, and μ is the mean of all values. This measure quantifies the amount of variation or dispersion in a set of values.\n\nThe normal distribution probability density function:\n\n$$\nf(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}(\\frac{x-\\mu}{\\sigma})^2}\n$$\n\nThis function describes the probability distribution of many natural phenomena and serves as the foundation for numerous statistical tests and modeling approaches. Understanding these mathematical concepts is essential for effective data analysis and interpretation in fields ranging from healthcare to finance and scientific research.',

      'Dummy Content Element 3':
        "# Environmental Systems\n\n## Carbon Cycle\n\nThe carbon cycle is a biogeochemical cycle where carbon is exchanged among the biosphere, pedosphere, geosphere, hydrosphere, and atmosphere of the Earth. Human activities have significantly altered the natural carbon cycle, leading to increased atmospheric carbon dioxide concentrations and associated climate change effects.\n\n* **Photosynthesis**: Plants convert CO₂ to organic compounds, $$6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2$$. This process removes approximately 120 gigatons of carbon from the atmosphere annually, playing a crucial role in regulating atmospheric CO₂ levels.\n* **Respiration**: Organisms break down glucose, releasing energy and CO₂. This cellular process occurs in almost all living organisms and returns carbon to the atmosphere or aquatic environments.\n* **Decomposition**: Organic matter breaks down, releasing carbon back to the environment. Microorganisms facilitate this process, converting complex organic molecules into simpler compounds and eventually releasing CO₂.\n* **Ocean exchange**: The ocean absorbs and releases carbon dioxide through various physical, chemical, and biological processes, serving as the largest active carbon sink on Earth.\n* **Fossil fuel combustion**: Human burning of coal, oil, and natural gas releases carbon that was stored over millions of years, significantly altering the carbon cycle's balance.\n\n## Climate Change Factors\n\n1. Greenhouse gas emissions: Carbon dioxide, methane, nitrous oxide, and other gases that trap heat in the atmosphere\n2. Deforestation: Reduction in forest cover, limiting the Earth's capacity to sequester carbon through photosynthesis\n3. Industrial processes: Manufacturing activities that release greenhouse gases and other pollutants\n4. Agricultural practices: Farming methods that release greenhouse gases through soil disturbance, livestock production, and fertilizer use\n5. Land use changes: Conversion of natural ecosystems to human-dominated landscapes, altering carbon storage capacity\n6. Transportation systems: Fossil fuel consumption for moving people and goods globally\n\nThe relationship between radiative forcing (RF) and CO₂ concentration is:\n\n$$\n\\Delta F = 5.35 \\times \\ln\\left(\\frac{C}{C_0}\\right)\n$$\n\nWhere:\n* $$\\Delta F$$ is the radiative forcing in W/m²\n* $$C$$ is the current CO₂ concentration\n* $$C_0$$ is the pre-industrial CO₂ concentration\n\nThis logarithmic relationship explains why each additional unit of CO₂ has a diminishing warming effect, though the cumulative impact remains significant. Understanding these relationships is essential for climate modeling and developing effective mitigation strategies to address global climate change.",
    },
    USER_ID_TEST
  )) as Prisma.Element[]

  const groupActivityId1 = '99fe99d2-696c-46d7-b6ae-cf385879822a'
  await prisma.groupActivity.upsert({
    where: { id: groupActivityId1 },
    create: {
      id: groupActivityId1,
      name: 'Gruppenquest Published',
      displayName: 'Gruppenquest Published',
      description: `Description of the published group activity.`,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId1 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
  })

  const groupActivityId2 = 'c3e2e776-87fe-4b59-95dd-ac1977a411ba'
  await prisma.groupActivity.upsert({
    where: { id: groupActivityId2 },
    create: {
      id: groupActivityId2,
      name: 'Gruppenquest Scheduled',
      displayName: 'Gruppenquest Scheduled',
      description: `Description of the scheduled group activity.`,
      status: Prisma.PublicationStatus.SCHEDULED,
      scheduledStartAt: new Date('2040-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2050-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId2 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
  })

  const groupActivityId3 = '07e9847d-32bb-44a1-af49-de11a2151a92'
  await prisma.groupActivity.upsert({
    where: { id: groupActivityId3 },
    create: {
      id: groupActivityId3,
      name: 'Gruppenquest Draft',
      displayName: 'Gruppenquest Draft',
      description: `Description of the draft group activity.`,
      status: Prisma.PublicationStatus.DRAFT,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      pointsMultiplier: 2,
      parameters: {},
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId3 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
  })

  const groupActivityId4 = '89f84817-2669-42bb-9ca2-d643fdf72926'
  await prisma.groupActivity.upsert({
    where: { id: groupActivityId4 },
    create: {
      id: groupActivityId4,
      name: 'Gruppenquest Draft Past',
      displayName: 'Gruppenquest Draft Past',
      description: `Description of the draft group activity with a past end date.`,
      status: Prisma.PublicationStatus.DRAFT,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2022-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      pointsMultiplier: 2,
      parameters: {},
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId4 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
  })

  const groupActivityId5 = '8918501d-5e44-49d6-916e-43ba11794b96'
  const groupActivityCompleted = await prisma.groupActivity.upsert({
    where: { id: groupActivityId5 },
    create: {
      id: groupActivityId5,
      name: 'Gruppenquest Ended',
      displayName: 'Gruppenquest Ended',
      description: `Description of the completed group activity.`,
      status: Prisma.PublicationStatus.ENDED,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2021-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId5 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: [flashcards[0]!],
            questions: questionsTest,
            contentElements: [contentElements[0]!],
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
    include: { stacks: { include: { elements: true } } },
  })

  const groupActivityId6 = '62f4511e-6760-4cef-9784-1814891a0f2b'
  const groupActivityGraded = await prisma.groupActivity.upsert({
    where: { id: groupActivityId6 },
    create: {
      id: groupActivityId6,
      name: 'Gruppenquest Graded',
      displayName: 'Gruppenquest Graded',
      description: `Description of the graded group activity.`,
      status: Prisma.PublicationStatus.GRADED,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2021-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId6 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: [flashcards[0]!],
            questions: questionsTest,
            contentElements: [contentElements[0]!],
            courseId: COURSE_ID_TEST,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
    },
    update: {},
    include: { stacks: { include: { elements: true } } },
  })

  // create calendar course group activities with diverse scheduling patterns
  const calendarGroupActivityId1 = 'f8a5868e-1a18-47f2-b8f3-ccc8c1cea9f4'
  await prisma.groupActivity.upsert({
    where: { id: calendarGroupActivityId1 },
    create: {
      id: calendarGroupActivityId1,
      name: 'Calendar Group Activity 1',
      displayName: 'Calendar Group Activity 1',
      description: `A comprehensive 10-day innovation project where teams will analyze digital transformation case studies, develop innovative solutions, and present their findings. Runs from 14 days ago to 4 days ago.`,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() - 14 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(currentDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2.5,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({
            activityId: calendarGroupActivityId1,
          }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_CALENDAR,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
    },
    update: {},
  })

  const calendarGroupActivityId2 = 'c82187e5-a8ce-414e-9cd4-6e8243a1898e'
  await prisma.groupActivity.upsert({
    where: { id: calendarGroupActivityId2 },
    create: {
      id: calendarGroupActivityId2,
      name: 'Calendar Group Activity 2',
      displayName: 'Calendar Group Activity 2',
      description: `A short but intensive 3-day workshop focused on developing AI implementation strategies. Teams worked collaboratively from 9 to 7 days ago.`,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() - 9 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 1.8,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({
            activityId: calendarGroupActivityId2,
          }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: [flashcards[0]!],
            questions: questionsTest.slice(0, 3),
            contentElements: [contentElements[0]!],
            courseId: COURSE_ID_CALENDAR,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
    },
    update: {},
  })

  const calendarGroupActivityId3 = '1f660806-5588-4255-aec6-18024f6a41e8'
  await prisma.groupActivity.upsert({
    where: { id: calendarGroupActivityId3 },
    create: {
      id: calendarGroupActivityId3,
      name: 'Calendar Group Activity 3',
      displayName: 'Calendar Group Activity 3',
      description: `An extended 2-week data analytics project where teams will analyze real-world datasets and develop comprehensive reports. Runs from 2 days from now to 14 days from now.`,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() + 2 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(
        currentDate.getTime() + 14 * 24 * 60 * 60 * 1000
      ),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 3.0,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({
            activityId: calendarGroupActivityId3,
          }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: flashcards.slice(0, 2),
            questions: questionsTest.slice(0, 5),
            contentElements: contentElements.slice(0, 2),
            courseId: COURSE_ID_CALENDAR,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
    },
    update: {},
  })

  const calendarGroupActivityId4 = '3555a344-ae47-421d-b8ac-17507fcfea75'
  await prisma.groupActivity.upsert({
    where: { id: calendarGroupActivityId4 },
    create: {
      id: calendarGroupActivityId4,
      name: 'Calendar Group Activity 4',
      displayName: 'Calendar Group Activity 4',
      description: `A rapid 6-hour innovation sprint session where teams tackle specific challenges. Scheduled for 2 days ago from 9 AM to 3 PM.`,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() - 2 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(currentDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 1.5,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({
            activityId: calendarGroupActivityId4,
          }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: [flashcards[0]!],
            questions: questionsTest.slice(0, 2),
            contentElements: [contentElements[0]!],
            courseId: COURSE_ID_CALENDAR,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
    },
    update: {},
  })

  const calendarGroupActivityId5 = 'c1542840-7402-4a56-aac7-cdf91d545604'
  await prisma.groupActivity.upsert({
    where: { id: calendarGroupActivityId5 },
    create: {
      id: calendarGroupActivityId5,
      name: 'Calendar Group Activity 5',
      displayName: 'Calendar Group Activity 5',
      description: `A week-long project to design and present a comprehensive digital marketing campaign. Running 9-13 days from now.`,
      status: Prisma.PublicationStatus.SCHEDULED,
      scheduledStartAt: new Date(
        currentDate.getTime() + 9 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(
        currentDate.getTime() + 13 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000
      ),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      parameters: {},
      pointsMultiplier: 2.2,
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({
            activityId: calendarGroupActivityId5,
          }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            flashcards: flashcards.slice(0, 3),
            questions: questionsTest.slice(0, 4),
            contentElements: contentElements.slice(0, 2),
            courseId: COURSE_ID_CALENDAR,
          }),
        },
      },
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
    },
    update: {},
  })

  // extract the ids of the correct answer options to the selection question
  const selectionQuestion = questionsTest.find(
    (q) => q.type === Prisma.ElementType.SELECTION
  )
  const selectionResponse =
    selectionQuestion?.answerCollectionItems?.map((sol) => sol.id) ?? []

  const groupActivityDecisions = groupActivityCompleted.stacks[0]!.elements.map(
    (element) => {
      const baseDecisions = {
        instanceId: element.id,
        type: element.elementType,
      }

      if (element.elementType === Prisma.ElementType.CONTENT) {
        return {
          ...baseDecisions,
          contentResponse: true,
        }
      } else if (element.elementType === Prisma.ElementType.SC) {
        return {
          ...baseDecisions,
          choicesResponse: [{ ix: 1, selected: true }],
        }
      } else if (element.elementType === Prisma.ElementType.MC) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 1, selected: true },
            { ix: 2, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.KPRIM) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 0, selected: true },
            { ix: 1, selected: true },
            { ix: 3, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.FREE_TEXT) {
        return {
          ...baseDecisions,
          freeTextResponse: 'This is a free text response.',
        }
      } else if (element.elementType === Prisma.ElementType.NUMERICAL) {
        return {
          ...baseDecisions,
          numericalResponse: 10,
        }
      } else if (element.elementType === Prisma.ElementType.SELECTION) {
        return {
          ...baseDecisions,
          selectionResponse,
        }
      } else if (element.elementType === Prisma.ElementType.CASE_STUDY) {
        const caseStudyResponse = computeRandomCaseStudyDecisions({
          options: element.elementData.options as ElementOptionsCaseStudy,
        })

        return {
          ...baseDecisions,
          caseStudyResponse,
        }
      }
    }
  )

  const groupActivityDecisions2 =
    groupActivityCompleted.stacks[0]!.elements.map((element) => {
      const baseDecisions = {
        instanceId: element.id,
        type: element.elementType,
      }

      if (element.elementType === Prisma.ElementType.CONTENT) {
        return {
          ...baseDecisions,
          contentResponse: true,
        }
      } else if (element.elementType === Prisma.ElementType.SC) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 0, selected: true },
            { ix: 2, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.MC) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 0, selected: true },
            { ix: 2, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.KPRIM) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 0, selected: true },
            { ix: 2, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.FREE_TEXT) {
        return {
          ...baseDecisions,
          freeTextResponse: 'This is a new free text response.',
        }
      } else if (element.elementType === Prisma.ElementType.NUMERICAL) {
        return {
          ...baseDecisions,
          numericalResponse: 97,
        }
      } else if (element.elementType === Prisma.ElementType.SELECTION) {
        return {
          ...baseDecisions,
          selectionResponse,
        }
      } else if (element.elementType === Prisma.ElementType.CASE_STUDY) {
        const caseStudyResponse = computeRandomCaseStudyDecisions({
          options: element.elementData.options as ElementOptionsCaseStudy,
        })

        return {
          ...baseDecisions,
          caseStudyResponse,
        }
      }
    })

  const groupActivityDecisionsGraded =
    groupActivityGraded.stacks[0]!.elements.map((element) => {
      const baseDecisions = {
        instanceId: element.id,
        type: element.elementType,
      }

      if (element.elementType === Prisma.ElementType.CONTENT) {
        return {
          ...baseDecisions,
          contentResponse: true,
        }
      } else if (element.elementType === Prisma.ElementType.SC) {
        return {
          ...baseDecisions,
          choicesResponse: [{ ix: 1, selected: true }],
        }
      } else if (element.elementType === Prisma.ElementType.MC) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 1, selected: true },
            { ix: 2, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.KPRIM) {
        return {
          ...baseDecisions,
          choicesResponse: [
            { ix: 0, selected: true },
            { ix: 1, selected: true },
            { ix: 3, selected: true },
          ],
        }
      } else if (element.elementType === Prisma.ElementType.FREE_TEXT) {
        return {
          ...baseDecisions,
          freeTextResponse: 'This is a free text response.',
        }
      } else if (element.elementType === Prisma.ElementType.NUMERICAL) {
        return {
          ...baseDecisions,
          numericalResponse: 10,
        }
      } else if (element.elementType === Prisma.ElementType.SELECTION) {
        return {
          ...baseDecisions,
          selectionResponse,
        }
      } else if (element.elementType === Prisma.ElementType.CASE_STUDY) {
        const caseStudyResponse = computeRandomCaseStudyDecisions({
          options: element.elementData.options as ElementOptionsCaseStudy,
        })

        return {
          ...baseDecisions,
          caseStudyResponse,
        }
      }
    })

  // seed multiple group activity instance with decisions
  const groupActivityInstanceId = 1
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId,
    },
    create: {
      decisions: groupActivityDecisions,
      decisionsSubmittedAt: new Date('2020-06-01T11:00:00.000Z'),
      groupActivity: {
        connect: {
          id: groupActivityId5,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[0],
        },
      },
    },
    update: {},
  })

  const groupActivityInstanceId2 = 2
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId2,
    },
    create: {
      decisions: groupActivityDecisions2,
      decisionsSubmittedAt: new Date('2020-06-10T11:00:00.000Z'),
      groupActivity: {
        connect: {
          id: groupActivityId5,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[1],
        },
      },
    },
    update: {},
  })

  const groupActivityInstanceId3 = 3
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId3,
    },
    create: {
      decisions: groupActivityDecisions,
      decisionsSubmittedAt: new Date('2020-06-20T11:00:00.000Z'),
      groupActivity: {
        connect: {
          id: groupActivityId5,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[2],
        },
      },
    },
    update: {},
  })

  // seed group activity instance without results
  const groupActivityInstanceId4 = 4
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId4,
    },
    create: {
      groupActivity: {
        connect: {
          id: groupActivityId5,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[3],
        },
      },
    },
    update: {},
  })

  const groupActivityResults = {
    passed: true,
    points: 43,
    comment: 'This is an optional comment by the lecturer.',
    grading: groupActivityCompleted.stacks[0]!.elements.reduce<
      {
        instanceId: number
        correctness: string
        score: number
        feedback?: string
      }[]
    >((acc, element) => {
      if (element.elementType === Prisma.ElementType.CONTENT) return acc

      const maxPoints = (element.options.pointsMultiplier ?? 1) * 25 // default: 25 points
      const correctness = ['INCORRECT', 'PARTIAL', 'CORRECT'][
        Math.floor(Math.random() * 3)
      ] as 'INCORRECT' | 'PARTIAL' | 'CORRECT'

      return [
        ...acc,
        {
          instanceId: element.id,
          correctness: correctness,
          maxPoints: maxPoints,
          score:
            correctness === 'CORRECT'
              ? maxPoints
              : correctness === 'PARTIAL'
                ? Math.floor(Math.random() * maxPoints)
                : 0,
          ...(correctness === 'INCORRECT' && {
            feedback:
              'In case of an incorrect answer, this feedback is provided.',
          }),
          ...(correctness === 'PARTIAL' && {
            feedback:
              'In case of a partially correct answer, this feedback is provided.',
          }),
        },
      ]
    }, []),
  }

  const groupActivityResultsGraded = {
    passed: true,
    points: 105,
    comment: 'This is an optional comment by the lecturer.',
    grading: groupActivityGraded.stacks[0]!.elements.reduce<
      {
        instanceId: number
        correctness: string
        score: number
        feedback?: string
      }[]
    >((acc, element) => {
      if (element.elementType === Prisma.ElementType.CONTENT) return acc

      const maxPoints = (element.options.pointsMultiplier ?? 1) * 25 // default: 25 points
      const correctness = ['INCORRECT', 'PARTIAL', 'CORRECT'][
        Math.floor(Math.random() * 3)
      ] as 'INCORRECT' | 'PARTIAL' | 'CORRECT'

      return [
        ...acc,
        {
          instanceId: element.id,
          correctness: correctness,
          maxPoints: maxPoints,
          score:
            correctness === 'CORRECT'
              ? maxPoints
              : correctness === 'PARTIAL'
                ? Math.floor(Math.random() * maxPoints)
                : 0,
          ...(correctness === 'INCORRECT' && {
            feedback:
              'In case of an incorrect answer, this feedback is provided.',
          }),
          ...(correctness === 'PARTIAL' && {
            feedback:
              'In case of a partially correct answer, this feedback is provided.',
          }),
        },
      ]
    }, []),
  }

  // seed group activity instance with decisions and results for partially graded and ended group activity
  const groupActivityInstanceId5 = 5
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId5,
    },
    create: {
      decisions: groupActivityDecisions2,
      decisionsSubmittedAt: new Date('2020-06-15T11:00:00.000Z'),
      results: groupActivityResults,
      resultsComputedAt: new Date(),
      groupActivity: {
        connect: {
          id: groupActivityId5,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[4],
        },
      },
    },
    update: {},
  })

  // seed group activity instance with decisions and results for graded and ended group activity
  const groupActivityInstanceId6 = 6
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId6,
    },
    create: {
      decisions: groupActivityDecisionsGraded,
      decisionsSubmittedAt: new Date('2020-06-15T11:00:00.000Z'),
      results: groupActivityResultsGraded,
      resultsComputedAt: new Date(),
      groupActivity: {
        connect: {
          id: groupActivityId6,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[0],
        },
      },
    },
    update: {},
  })

  const groupActivityInstanceId7 = 7
  await prisma.groupActivityInstance.upsert({
    where: {
      id: groupActivityInstanceId7,
    },
    create: {
      decisions: groupActivityDecisionsGraded,
      decisionsSubmittedAt: new Date('2020-06-15T12:00:00.000Z'),
      results: groupActivityResultsGraded,
      resultsComputedAt: new Date(),
      groupActivity: {
        connect: {
          id: groupActivityId6,
        },
      },
      group: {
        connect: {
          id: PARTICIPANT_GROUP_IDS[1],
        },
      },
    },
    update: {},
  })

  // extract all questions that are valid to be used in asynchronous activities (practice quizzes / microlearnings)
  const asyncActivityQuestions = questionsTest.filter(
    (q) =>
      q.type === Prisma.ElementType.CONTENT ||
      q.type === Prisma.ElementType.FLASHCARD ||
      q.type === Prisma.ElementType.FREE_TEXT ||
      q.options.hasSampleSolution
  )

  const quizId = '4214338b-c5af-4ff7-84f9-ae5a139d6e5b'
  await prisma.practiceQuiz.upsert({
    where: { id: quizId },
    create: {
      id: quizId,
      name: 'Practice Quiz Demo',
      displayName: 'Practice Quiz Demo Student Title',
      description:
        'This is a **description** of the practice quiz, illustrating the use of flashcards, questions and content elements.',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      status: Prisma.PublicationStatus.PUBLISHED,
      orderType: Prisma.ElementOrderType.SPACED_REPETITION,
      availableFrom: new Date('2020-01-01T11:00:00.000Z'),
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_TEST,
            connectToCourse: true,
            activityType: ActivityType.PRACTICE_QUIZ,
          }),
        ],
      },
    },
    update: {},
    include: { stacks: { include: { elements: true } } },
  })

  const quizId2 = '58cfd921-2bc1-40a4-a186-846626eb0591'
  await prisma.practiceQuiz.upsert({
    where: { id: quizId2 },
    create: {
      id: quizId2,
      name: 'Practice Quiz Draft',
      displayName: 'Practice Quiz Draft Student Title',
      description:
        'This is a **description** of the practice quiz, illustrating the use of flashcards, questions and content elements.',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      status: Prisma.PublicationStatus.DRAFT,
      orderType: Prisma.ElementOrderType.SPACED_REPETITION,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: [flashcards[0]!],
            questions: [questionsTest[0]!],
            contentElements: [contentElements[0]!],
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.PRACTICE_QUIZ,
          }),
        ],
      },
    },
    update: {},
    include: { stacks: { include: { elements: true } } },
  })

  const quizId3 = '56e51ab4-89e3-4d9d-ae04-dd9e8869fbd2'
  await prisma.practiceQuiz.upsert({
    where: { id: quizId3 },
    create: {
      id: quizId3,
      name: 'Practice Quiz Future',
      displayName: 'Practice Quiz Future Student Title',
      description:
        'This is a **description** of the practice quiz, illustrating the use of flashcards, questions and content elements.',
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      status: Prisma.PublicationStatus.SCHEDULED,
      orderType: Prisma.ElementOrderType.SPACED_REPETITION,
      availableFrom: new Date('2030-01-01T11:00:00.000Z'),
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: [flashcards[0]!],
            questions: [questionsTest[0]!],
            contentElements: [contentElements[0]!],
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.PRACTICE_QUIZ,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId1 = 'd2f7fcbc-a54c-4518-b094-91d8adbd803f'
  await prisma.microLearning.upsert({
    where: { id: microlearningId1 },
    create: {
      id: microlearningId1,
      name: 'Test Microlearning',
      displayName: 'Test Microlearning',
      description: `
Diese Woche lernen wir...

Mehr bla bla...
`,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
      pointsMultiplier: 4,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId2 = '6a0b6674-5f9b-40fd-90a4-53d493c210ba'
  await prisma.microLearning.upsert({
    where: { id: microlearningId2 },
    create: {
      id: microlearningId2,
      name: 'Test Microlearning Future',
      displayName: 'Test Microlearning Future',
      description: `
In ferner Zukunft lernen wir...

Mehr bla bla...
`,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
      pointsMultiplier: 1,
      status: Prisma.PublicationStatus.DRAFT,
      scheduledEndAt: new Date('2040-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2030-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId3 = '71702826-e693-451d-ad64-ed763d973fcd'
  await prisma.microLearning.upsert({
    where: { id: microlearningId3 },
    create: {
      id: microlearningId3,
      name: 'Test Microlearning Past',
      displayName: 'Test Microlearning Past',
      description: `Dieses Microlearning ist bereits vorbei...`,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
      pointsMultiplier: 1,
      status: Prisma.PublicationStatus.ENDED,
      scheduledEndAt: new Date('2024-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId4 = '4a87f88d-5fb9-4eef-afce-9f5ed6edcc38'
  await prisma.microLearning.upsert({
    where: { id: microlearningId4 },
    create: {
      id: microlearningId4,
      name: 'Test Microlearning Past No FT',
      displayName: 'Test Microlearning Past No FT',
      description: `Dieses Microlearning ist bereits vorbei und enthält keine Freitext fragen (-> aktuelle Validierung)...`,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
      pointsMultiplier: 1,
      status: Prisma.PublicationStatus.ENDED,
      scheduledEndAt: new Date('2024-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions.filter(
              (q) => q.type !== Prisma.ElementType.FREE_TEXT
            ),
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId5 = 'ec13a44b-22ce-4edc-b419-e2d7c07024fe'
  await prisma.microLearning.upsert({
    where: { id: microlearningId5 },
    create: {
      id: microlearningId5,
      name: 'Test Microlearning Draft',
      displayName: 'Test Microlearning Draft',
      description: `
Once this microlearning is published, it will be immediately accessible
`,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_TEST } },
      pointsMultiplier: 1,
      status: Prisma.PublicationStatus.DRAFT,
      scheduledEndAt: new Date('2040-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards,
            questions: asyncActivityQuestions,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  // create calendar course practice quizzes with diverse scheduling
  const calendarPracticeQuizId1 = '7c5a84ef-ad0f-423d-8061-484401cd38c2'
  await prisma.practiceQuiz.upsert({
    where: { id: calendarPracticeQuizId1 },
    create: {
      id: calendarPracticeQuizId1,
      name: 'Calendar Practice Quiz 1',
      displayName: 'Calendar Practice Quiz 1',
      description:
        'Comprehensive practice quiz covering digital transformation concepts. Available since 2 weeks ago.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 1.5,
      status: Prisma.PublicationStatus.PUBLISHED,
      availableFrom: new Date(currentDate.getTime() - 14 * 24 * 60 * 60 * 1000),
      resetTimeDays: 7,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      orderType: Prisma.ElementOrderType.SEQUENTIAL,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 5),
            questions: asyncActivityQuestions.slice(0, 8),
            contentElements: contentElements.slice(0, 2),
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.PRACTICE_QUIZ,
          }),
        ],
      },
    },
    update: {},
  })

  const calendarPracticeQuizId2 = '31ff1123-86ed-4284-95eb-dca8b793b3ad'
  await prisma.practiceQuiz.upsert({
    where: { id: calendarPracticeQuizId2 },
    create: {
      id: calendarPracticeQuizId2,
      name: 'Calendar Practice Quiz 2',
      displayName: 'Calendar Practice Quiz 2',
      description:
        'Advanced practice quiz focusing on data analytics techniques. Higher difficulty with bonus point opportunities. Available since 11 days ago.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 2.0,
      status: Prisma.PublicationStatus.SCHEDULED,
      availableFrom: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      resetTimeDays: 3,
      orderType: Prisma.ElementOrderType.SEQUENTIAL,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 3),
            questions: asyncActivityQuestions.slice(3, 10),
            contentElements: [contentElements[1]!],
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.PRACTICE_QUIZ,
          }),
        ],
      },
    },
    update: {},
  })

  // Create calendar course microlearnings with diverse scheduling patterns
  const calendarMicrolearning1Id = '532d2483-0e39-4da4-951a-7f8c00e75600'
  await prisma.microLearning.upsert({
    where: { id: calendarMicrolearning1Id },
    create: {
      id: calendarMicrolearning1Id,
      name: 'Calendar Microlearning 1',
      displayName: 'Calendar Microlearning 1',
      description:
        'Short daily sessions on AI ethics and responsible AI development. 1-hour daily commitments for 5 days starting 10 days ago.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 1.2,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() - 10 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(currentDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 4),
            questions: asyncActivityQuestions.slice(0, 6),
            contentElements: [contentElements[0]!],
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const calendarMicrolearning2Id = '0e51701e-e849-4478-b6dd-8e27cf21ae2d'
  await prisma.microLearning.upsert({
    where: { id: calendarMicrolearning2Id },
    create: {
      id: calendarMicrolearning2Id,
      name: 'Calendar Microlearning 2',
      displayName: 'Calendar Microlearning 2',
      description:
        'Intensive weekend learning session covering innovation methodologies. 6-hour sessions on today and tomorrow.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 2.5,
      status: Prisma.PublicationStatus.SCHEDULED,
      scheduledStartAt: new Date(currentDate.getTime() + 10 * 60 * 60 * 1000),
      scheduledEndAt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 6),
            questions: asyncActivityQuestions.slice(0, 12),
            contentElements: contentElements.slice(0, 3),
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const calendarMicroLearning3Id = 'e5de398b-3c01-4cac-98fc-51b4593e1719'
  await prisma.microLearning.upsert({
    where: { id: calendarMicroLearning3Id },
    create: {
      id: calendarMicroLearning3Id,
      name: 'Calendar Microlearning 3',
      displayName: 'Calendar Microlearning 3',
      description:
        'Extended learning path covering agile methodologies over 10 days. Flexible scheduling from 4 days from now to 14 days from now.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 1.8,
      status: Prisma.PublicationStatus.SCHEDULED,
      scheduledStartAt: new Date(
        currentDate.getTime() + 4 * 24 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(
        currentDate.getTime() +
          14 * 24 * 60 * 60 * 1000 +
          23 * 60 * 60 * 1000 +
          59 * 60 * 1000
      ),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 8),
            questions: asyncActivityQuestions.slice(0, 15),
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  const calendarMicrolearning4Id = 'a4d6f5ca-9d81-4f94-be71-1b62c85eb745'
  await prisma.microLearning.upsert({
    where: { id: calendarMicrolearning4Id },
    create: {
      id: calendarMicrolearning4Id,
      name: 'Calendar Microlearning 4',
      displayName: 'Calendar Microlearning 4',
      description:
        'Short 2-hour sessions on digital marketing trends and strategies. Running 11-13 days from now.',
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: COURSE_ID_CALENDAR } },
      pointsMultiplier: 1.3,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(
        currentDate.getTime() + 11 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000
      ),
      scheduledEndAt: new Date(
        currentDate.getTime() + 13 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000
      ),
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      stacks: {
        create: [
          ...prepareStackVariety({
            flashcards: flashcards.slice(0, 3),
            questions: asyncActivityQuestions.slice(0, 5),
            contentElements: [contentElements[2]!],
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_CALENDAR,
            activityType: ActivityType.MICRO_LEARNING,
          }),
        ],
      },
    },
    update: {},
  })

  // update derived permissions for all test courses
  const courseIds = [
    COURSE_ID_TEST,
    COURSE_ID_TEST2,
    COURSE_ID_TEST3,
    COURSE_ID_ASSESSMENT,
    COURSE_ID_TEST5,
    COURSE_ID_CALENDAR,
  ]
  for (const courseId of courseIds) {
    await recomputeDerivedPermissions(
      {
        courseId,
        userId: USER_ID_TEST,
      },
      prisma
    )
  }
}

await seedTest(prisma)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
