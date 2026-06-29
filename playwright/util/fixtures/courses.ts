import {
  CourseAuthType,
  ElementBlockStatus,
  PermissionLevel,
  PublicationStatus,
  ResponseCorrectness,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../../global-setup.js'
import { USER_ID_TEST } from '../constants.js'

type CourseDuplicationActivityCollection =
  | 'liveQuizzes'
  | 'practiceQuizzes'
  | 'microLearnings'
  | 'groupActivities'

type CourseDuplicationActivityReference = {
  id: string
  name: string
  status: string
  instances: {
    instanceId: number
    elementId: number
    elementName: string
    elementContent: string
    elementDataContent: string | null
  }[]
}

export type CourseDuplicationSummary = {
  courseId: string
  ownerId: string
  authType: string
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  pinCode: number | null
  competencyTreeId: number | null
  competencyTreeName: string | null
  liveQuizzes: number
  practiceQuizzes: number
  microLearnings: number
  groupActivities: number
  liveQuizStatuses: string[]
  practiceQuizStatuses: string[]
  microLearningStatuses: string[]
  groupActivityStatuses: string[]
  activityReferences: Record<
    CourseDuplicationActivityCollection,
    CourseDuplicationActivityReference[]
  >
  directPermissionDetails: CourseDuplicationPermissionDetail[]
  derivedPermissionDetails: CourseDuplicationPermissionDetail[]
  participations: number
  participantGroups: number
  participantInvitations: number
  groupAssignmentPoolEntries: number
  directPermissions: number
  questionResponses: number
  questionResponseDetails: number
  liveQuizResponses: number
  pointCorrections: number
  groupActivityInstances: number
  activityPerformances: number
  activityProgresses: number
  participantPerformances: number
  participantActivityPerformances: number
  aggregatedAnalytics: number
  aggregatedCourseAnalytics: number
  participantCourseAnalytics: number
}

export type CourseDuplicationPermissionDetail = {
  objectType: string
  objectId: string
  permissionLevel: string
  propagation: boolean | null
  derived: boolean | null
  directPermissionId: number | null
  userId: string | null
  userShortname: string | null
  userGroupId: number | null
  userGroupName: string | null
}

export type CourseLiveQuizResponseSummary = {
  courseId: string
  liveQuizId: string
  status: string
  instanceIds: number[]
  responseCount: number
  correctnesses: string[]
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  resultTotals: number[]
}

export async function getCoursePin(courseName: string) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName },
    select: { pinCode: true },
  })

  if (!course?.pinCode) {
    throw new Error(`Course with name ${courseName} has no pin code.`)
  }

  return course.pinCode
}

export async function deleteCourseByName({
  courseName,
  ownerId,
}: {
  courseName: string
  ownerId?: string
}) {
  const prisma = await getPrisma()
  await prisma.course.deleteMany({
    where: { name: courseName, ownerId },
  })
}

export async function deleteCourseWithActivitiesByName({
  courseName,
  ownerId,
}: {
  courseName: string
  ownerId?: string
}) {
  const prisma = await getPrisma()
  const courses = await prisma.course.findMany({
    where: { name: courseName, ownerId },
    select: { id: true },
  })
  const courseIds = courses.map((course) => course.id)

  if (courseIds.length === 0) return

  await prisma.$transaction([
    prisma.groupActivity.deleteMany({
      where: { courseId: { in: courseIds } },
    }),
    prisma.microLearning.deleteMany({
      where: { courseId: { in: courseIds } },
    }),
    prisma.practiceQuiz.deleteMany({
      where: { courseId: { in: courseIds } },
    }),
    prisma.liveQuiz.deleteMany({
      where: { courseId: { in: courseIds } },
    }),
    prisma.course.deleteMany({
      where: { id: { in: courseIds } },
    }),
  ])
}

export async function createCourseRecord({
  name,
  displayName,
  description,
  notificationEmail,
  startDate,
  endDate,
  color,
  isAssessmentEnabled = false,
  isGamificationEnabled = true,
  isGroupCreationEnabled = true,
  groupDeadlineDate,
  maxGroupSize = 4,
  preferredGroupSize = 2,
  participants = [],
  ownerId = USER_ID_TEST,
}: {
  name: string
  displayName: string
  description?: string
  notificationEmail?: string
  startDate: Date
  endDate: Date
  color?: string
  isAssessmentEnabled?: boolean
  isGamificationEnabled?: boolean
  isGroupCreationEnabled?: boolean
  groupDeadlineDate?: Date
  maxGroupSize?: number
  preferredGroupSize?: number
  participants?: string[]
  ownerId?: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.create({
    data: {
      name,
      displayName,
      description,
      notificationEmail,
      isAssessmentEnabled,
      isGamificationEnabled,
      color,
      pinCode: !isAssessmentEnabled
        ? Math.floor(100000000 + Math.random() * 900000000)
        : null,
      startDate,
      endDate,
      isGroupCreationEnabled,
      groupDeadlineDate: groupDeadlineDate ?? endDate,
      maxGroupSize,
      preferredGroupSize,
      authType: isAssessmentEnabled ? CourseAuthType.SSO : CourseAuthType.PIN,
      owner: { connect: { id: ownerId } },
    },
  })

  await prisma.derivedPermission.upsert({
    where: {
      courseId_userId: {
        courseId: course.id,
        userId: ownerId,
      },
    },
    create: {
      permissionLevel: PermissionLevel.OWNER,
      course: { connect: { id: course.id } },
      user: { connect: { id: ownerId } },
    },
    update: { permissionLevel: PermissionLevel.OWNER },
  })

  for (const username of participants) {
    const participant = await prisma.participant.findUnique({
      where: { username },
    })

    if (participant) {
      await prisma.participation.create({
        data: {
          participant: { connect: { id: participant.id } },
          course: { connect: { id: course.id } },
        },
      })
    }
  }

  return course
}

export async function ensureCourseParticipation({
  courseName,
  participantUsername,
}: {
  courseName: string
  participantUsername: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId: USER_ID_TEST },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found.`)
  }

  const participant = await prisma.participant.findUnique({
    where: { username: participantUsername },
    select: { id: true },
  })

  if (!participant) {
    throw new Error(
      `Participant with username ${participantUsername} not found.`
    )
  }

  await prisma.participation.upsert({
    where: {
      courseId_participantId: {
        courseId: course.id,
        participantId: participant.id,
      },
    },
    create: {
      course: { connect: { id: course.id } },
      participant: { connect: { id: participant.id } },
    },
    update: {},
  })

  return course.id
}

export async function submitCourseLiveQuizStudentResponse({
  courseName,
  liveQuizName,
  participantUsername,
}: {
  courseName: string
  liveQuizName: string
  participantUsername: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId: USER_ID_TEST },
    orderBy: { createdAt: 'desc' },
    include: {
      liveQuizzes: {
        where: { name: liveQuizName, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          blocks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  results: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found`)
  }

  const liveQuiz = course.liveQuizzes[0]
  if (!liveQuiz) {
    throw new Error(
      `Live quiz ${liveQuizName} not found in course ${courseName}`
    )
  }

  const block =
    liveQuiz.blocks.find(
      (candidate) => candidate.id === liveQuiz.activeBlockId
    ) ??
    liveQuiz.blocks.find(
      (candidate) => candidate.status === ElementBlockStatus.ACTIVE
    ) ??
    liveQuiz.blocks[0]

  if (!block) {
    throw new Error(
      `Live quiz ${liveQuizName} in course ${courseName} has no blocks`
    )
  }

  const instance = block.elements[0]
  if (!instance) {
    throw new Error(
      `Live quiz ${liveQuizName} in course ${courseName} has no element instances`
    )
  }

  const participant = await prisma.participant.findUnique({
    where: { username: participantUsername },
    select: { id: true },
  })

  if (!participant) {
    throw new Error(
      `Participant with username ${participantUsername} not found`
    )
  }

  const { choiceIx, results } = incrementChoicesElementResults(instance.results)
  const response = {
    choices: [{ ix: choiceIx, selected: true }],
  }
  const now = new Date()

  await prisma.$transaction([
    prisma.liveQuizResponse.upsert({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instance.id,
          elementBlockExecution: block.execution,
          participantId: participant.id,
        },
      },
      create: {
        submittedAt: now,
        response,
        timeSpent: 1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: liveQuiz.defaultPoints,
        correctnessPoints: liveQuiz.defaultCorrectPoints,
        bonusPoints: 0,
        instance: { connect: { id: instance.id } },
        elementBlockExecution: block.execution,
        participant: { connect: { id: participant.id } },
      },
      update: {
        submittedAt: now,
        response,
        timeSpent: 1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: liveQuiz.defaultPoints,
        correctnessPoints: liveQuiz.defaultCorrectPoints,
        bonusPoints: 0,
        correctionOnly: false,
      },
    }),
    prisma.elementInstance.update({
      where: { id: instance.id },
      data: { results },
    }),
  ])

  return {
    courseId: course.id,
    liveQuizId: liveQuiz.id,
    instanceId: instance.id,
    choiceIx,
  }
}

export async function getCourseLiveQuizResponseSummary({
  courseName,
  liveQuizName,
  participantUsername,
}: {
  courseName: string
  liveQuizName: string
  participantUsername: string
}): Promise<CourseLiveQuizResponseSummary> {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId: USER_ID_TEST },
    orderBy: { createdAt: 'desc' },
    include: {
      liveQuizzes: {
        where: { name: liveQuizName, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          blocks: {
            include: {
              elements: {
                select: {
                  id: true,
                  results: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found`)
  }

  const liveQuiz = course.liveQuizzes[0]
  if (!liveQuiz) {
    throw new Error(
      `Live quiz ${liveQuizName} not found in course ${courseName}`
    )
  }

  const participant = await prisma.participant.findUnique({
    where: { username: participantUsername },
  })

  if (!participant) {
    throw new Error(
      `Participant with username ${participantUsername} not found`
    )
  }

  const instances = liveQuiz.blocks.flatMap((block) => block.elements)
  const instanceIds = instances.map((instance) => instance.id)
  const responses = await prisma.liveQuizResponse.findMany({
    where: {
      participantId: participant.id,
      instanceId: { in: instanceIds },
    },
    select: {
      id: true,
      correctness: true,
      basePoints: true,
      correctnessPoints: true,
      bonusPoints: true,
      instanceId: true,
    },
  })

  return {
    courseId: course.id,
    liveQuizId: liveQuiz.id,
    status: liveQuiz.status,
    instanceIds,
    responseCount: responses.length,
    correctnesses: responses.map((response) => response.correctness),
    basePoints: responses.reduce(
      (total, response) => total + response.basePoints,
      0
    ),
    correctnessPoints: responses.reduce(
      (total, response) => total + response.correctnessPoints,
      0
    ),
    bonusPoints: responses.reduce(
      (total, response) => total + response.bonusPoints,
      0
    ),
    resultTotals: instances.map((instance) => {
      const results = instance.results as { total?: number } | null
      return results?.total ?? 0
    }),
  }
}

export async function createDeletedCourseActivities(courseName: string) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId: USER_ID_TEST },
    select: { id: true, ownerId: true },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found.`)
  }

  const deletedActivityName = `${courseName} Deleted Activity`
  const now = new Date()
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  await Promise.all([
    prisma.liveQuiz.create({
      data: {
        name: `${deletedActivityName} Live Quiz`,
        displayName: `${deletedActivityName} Live Quiz`,
        isDeleted: true,
        owner: { connect: { id: course.ownerId } },
        course: { connect: { id: course.id } },
      },
    }),
    prisma.practiceQuiz.create({
      data: {
        name: `${deletedActivityName} Practice Quiz`,
        displayName: `${deletedActivityName} Practice Quiz`,
        isDeleted: true,
        owner: { connect: { id: course.ownerId } },
        course: { connect: { id: course.id } },
      },
    }),
    prisma.microLearning.create({
      data: {
        name: `${deletedActivityName} Microlearning`,
        displayName: `${deletedActivityName} Microlearning`,
        scheduledStartAt: now,
        scheduledEndAt: later,
        isDeleted: true,
        owner: { connect: { id: course.ownerId } },
        course: { connect: { id: course.id } },
      },
    }),
    prisma.groupActivity.create({
      data: {
        name: `${deletedActivityName} Group Activity`,
        displayName: `${deletedActivityName} Group Activity`,
        scheduledStartAt: now,
        scheduledEndAt: later,
        isDeleted: true,
        owner: { connect: { id: course.ownerId } },
        course: { connect: { id: course.id } },
      },
    }),
  ])
}

export async function createCourseDuplicationFailureFixture(
  courseName: string
) {
  const prisma = await getPrisma()

  await prisma.course.deleteMany({
    where: { name: courseName, ownerId: USER_ID_TEST },
  })

  const now = new Date()
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const course = await createCourseRecord({
    name: courseName,
    displayName: courseName,
    notificationEmail: 'lecturer@df.uzh.ch',
    startDate: now,
    endDate: later,
    isAssessmentEnabled: false,
    isGamificationEnabled: true,
    isGroupCreationEnabled: true,
    groupDeadlineDate: later,
    maxGroupSize: 5,
    preferredGroupSize: 3,
  })

  const groupActivity = await prisma.groupActivity.create({
    data: {
      name: `${courseName} Group Activity`,
      displayName: `${courseName} Group Activity`,
      scheduledStartAt: now,
      scheduledEndAt: later,
      owner: { connect: { id: USER_ID_TEST } },
      course: { connect: { id: course.id } },
    },
  })

  await prisma.derivedPermission.upsert({
    where: {
      groupActivityId_userId: {
        groupActivityId: groupActivity.id,
        userId: USER_ID_TEST,
      },
    },
    create: {
      permissionLevel: PermissionLevel.OWNER,
      groupActivity: { connect: { id: groupActivity.id } },
      user: { connect: { id: USER_ID_TEST } },
    },
    update: { permissionLevel: PermissionLevel.OWNER },
  })
}

export async function attachCourseCompetencyTree({
  courseName,
  ownerId = USER_ID_TEST,
  treeName,
}: {
  courseName: string
  ownerId?: string
  treeName: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found.`)
  }

  const competencyTree = await prisma.competencyTree.upsert({
    where: {
      ownerId_name: {
        ownerId,
        name: treeName,
      },
    },
    create: {
      name: treeName,
      description: `${treeName} description`,
      ownerId,
    },
    update: {},
  })

  await prisma.course.update({
    where: { id: course.id },
    data: { competencyTreeId: competencyTree.id },
  })

  return {
    courseId: course.id,
    competencyTreeId: competencyTree.id,
    competencyTreeName: competencyTree.name,
  }
}

export async function grantLiveQuizDirectPermission({
  courseName,
  liveQuizName,
  ownerId,
  userId,
  permissionLevel,
  propagation,
}: {
  courseName: string
  liveQuizName: string
  ownerId?: string
  userId: string
  permissionLevel: PermissionLevel
  propagation: boolean
}) {
  const prisma = await getPrisma()
  const liveQuiz = await prisma.liveQuiz.findFirst({
    where: {
      name: liveQuizName,
      course: {
        name: courseName,
        ownerId,
      },
    },
    select: { id: true },
  })

  if (!liveQuiz) {
    throw new Error(
      `Live quiz "${liveQuizName}" in course "${courseName}" not found.`
    )
  }

  const permission = await prisma.permission.upsert({
    where: {
      liveQuizId_userId: {
        liveQuizId: liveQuiz.id,
        userId,
      },
    },
    create: {
      liveQuizId: liveQuiz.id,
      userId,
      permissionLevel,
      propagation,
    },
    update: {
      permissionLevel,
      propagation,
    },
  })

  return permission.id
}

export async function deleteLiveQuizDirectPermission({
  courseName,
  liveQuizName,
  ownerId,
  userId,
}: {
  courseName: string
  liveQuizName: string
  ownerId?: string
  userId: string
}) {
  const prisma = await getPrisma()
  const liveQuiz = await prisma.liveQuiz.findFirst({
    where: {
      name: liveQuizName,
      course: {
        name: courseName,
        ownerId,
      },
    },
    select: { id: true },
  })

  if (!liveQuiz) return 0

  const result = await prisma.permission.deleteMany({
    where: {
      liveQuizId: liveQuiz.id,
      userId,
    },
  })

  return result.count
}

export async function updateElementContentAndInstances({
  elementName,
  ownerId = USER_ID_TEST,
  content,
}: {
  elementName: string
  ownerId?: string
  content: string
}) {
  const prisma = await getPrisma()
  const element = await prisma.element.findFirst({
    where: { name: elementName, ownerId, isDeleted: false },
    select: { id: true },
  })

  if (!element) {
    throw new Error(`Element with name ${elementName} not found.`)
  }

  await prisma.element.update({
    where: { id: element.id },
    data: {
      content,
      version: { increment: 1 },
    },
  })

  const instances = await prisma.elementInstance.findMany({
    where: { elementId: element.id },
    select: { id: true, elementData: true },
  })

  await Promise.all(
    instances.map((instance) => {
      const elementData =
        instance.elementData &&
        typeof instance.elementData === 'object' &&
        !Array.isArray(instance.elementData)
          ? instance.elementData
          : {}

      return prisma.elementInstance.update({
        where: { id: instance.id },
        data: {
          elementData: {
            ...elementData,
            content,
          },
        },
      })
    })
  )

  return {
    elementId: element.id,
    updatedInstances: instances.length,
  }
}

export async function resetCourseLiveQuiz({
  courseName,
  liveQuizName,
}: {
  courseName: string
  liveQuizName: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId: USER_ID_TEST },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!course) {
    throw new Error(`Course with name ${courseName} not found.`)
  }

  const liveQuiz = await prisma.liveQuiz.findFirst({
    where: {
      name: liveQuizName,
      courseId: course.id,
      isDeleted: false,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      blocks: {
        include: {
          elements: { select: { id: true, results: true } },
        },
      },
    },
  })

  if (!liveQuiz) {
    throw new Error(
      `Live quiz ${liveQuizName} not found in course ${courseName}.`
    )
  }

  const instanceIds = liveQuiz.blocks.flatMap((block) =>
    block.elements.map((element) => element.id)
  )

  await prisma.liveQuizResponse.deleteMany({
    where: { instanceId: { in: instanceIds } },
  })
  await Promise.all(
    liveQuiz.blocks.flatMap((block) =>
      block.elements.map((element) =>
        prisma.elementInstance.update({
          where: { id: element.id },
          data: {
            results: resetElementResults(element.results),
          },
        })
      )
    )
  )
  await prisma.elementBlock.updateMany({
    where: { liveQuizId: liveQuiz.id },
    data: {
      status: ElementBlockStatus.SCHEDULED,
      execution: 0,
      startedAt: null,
      closedAt: null,
      expiresAt: null,
    },
  })
  await prisma.liveQuiz.update({
    where: { id: liveQuiz.id },
    data: {
      status: PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      activeBlockId: null,
    },
  })
}

function resetElementResults(results: Prisma.JsonValue) {
  if (!results || typeof results !== 'object' || Array.isArray(results)) {
    return results
  }

  const resetResults = { ...results } as Record<string, unknown>
  for (const key of Object.keys(resetResults)) {
    resetResults[key] = 0
  }

  return resetResults
}

function incrementChoicesElementResults(results: Prisma.JsonValue): {
  results: Record<string, unknown>
  choiceIx: number
} {
  const currentResults =
    results && typeof results === 'object' && !Array.isArray(results)
      ? (results as Record<string, unknown>)
      : {}
  const currentChoices =
    currentResults.choices &&
    typeof currentResults.choices === 'object' &&
    !Array.isArray(currentResults.choices)
      ? (currentResults.choices as Record<string, unknown>)
      : {}
  const choiceIx = Object.keys(currentChoices)
    .map(Number)
    .sort((a, b) => a - b)[0]

  if (typeof choiceIx !== 'number' || Number.isNaN(choiceIx)) {
    throw new Error('Live quiz element results do not contain any choices.')
  }

  return {
    choiceIx,
    results: {
      ...currentResults,
      choices: {
        ...currentChoices,
        [choiceIx]: Number(currentChoices[choiceIx] ?? 0) + 1,
      },
      total: Number(currentResults.total ?? 0) + 1,
    },
  }
}

export async function getCourseDuplicationSummary({
  courseName,
  ownerId,
}: {
  courseName: string
  ownerId?: string
}): Promise<CourseDuplicationSummary | null> {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName, ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ownerId: true,
      authType: true,
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      pinCode: true,
      competencyTree: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!course) return null

  const [liveQuizzes, practiceQuizzes, microLearnings, groupActivities] =
    await Promise.all([
      prisma.liveQuiz.findMany({
        where: { courseId: course.id, isDeleted: false },
        orderBy: { name: 'asc' },
        include: {
          blocks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  elementId: true,
                  elementData: true,
                  element: {
                    select: { id: true, name: true, content: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.practiceQuiz.findMany({
        where: { courseId: course.id, isDeleted: false },
        orderBy: { name: 'asc' },
        include: {
          stacks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  elementId: true,
                  elementData: true,
                  element: {
                    select: { id: true, name: true, content: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.microLearning.findMany({
        where: { courseId: course.id, isDeleted: false },
        orderBy: { name: 'asc' },
        include: {
          stacks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  elementId: true,
                  elementData: true,
                  element: {
                    select: { id: true, name: true, content: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.groupActivity.findMany({
        where: { courseId: course.id, isDeleted: false },
        orderBy: { name: 'asc' },
        include: {
          stacks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  elementId: true,
                  elementData: true,
                  element: {
                    select: { id: true, name: true, content: true },
                  },
                },
              },
            },
          },
        },
      }),
    ])
  const liveQuizIds = liveQuizzes.map((quiz) => quiz.id)
  const practiceQuizIds = practiceQuizzes.map((quiz) => quiz.id)
  const microLearningIds = microLearnings.map(
    (microLearning) => microLearning.id
  )
  const groupActivityIds = groupActivities.map((activity) => activity.id)
  const permissionObjectWhere = {
    OR: [
      { courseId: course.id },
      { liveQuizId: { in: liveQuizIds } },
      { practiceQuizId: { in: practiceQuizIds } },
      { microLearningId: { in: microLearningIds } },
      { groupActivityId: { in: groupActivityIds } },
    ],
  }

  const [
    participations,
    participantGroups,
    participantInvitations,
    groupAssignmentPoolEntries,
    directPermissions,
    questionResponses,
    questionResponseDetails,
    liveQuizResponses,
    pointCorrections,
    groupActivityInstances,
    activityPerformances,
    activityProgresses,
    participantPerformances,
    participantActivityPerformances,
    aggregatedAnalytics,
    aggregatedCourseAnalytics,
    participantCourseAnalytics,
  ] = await Promise.all([
    prisma.participation.count({ where: { courseId: course.id } }),
    prisma.participantGroup.count({ where: { courseId: course.id } }),
    prisma.participantInvitation.count({
      where: { courseId: course.id },
    }),
    prisma.groupAssignmentPoolEntry.count({
      where: { courseId: course.id },
    }),
    prisma.permission.count({
      where: permissionObjectWhere,
    }),
    prisma.questionResponse.count({
      where: { courseId: course.id },
    }),
    prisma.questionResponseDetail.count({
      where: {
        OR: [
          { practiceQuizId: { in: practiceQuizIds } },
          { microLearningId: { in: microLearningIds } },
        ],
      },
    }),
    prisma.liveQuizResponse.count({
      where: {
        instance: {
          elementBlock: { liveQuizId: { in: liveQuizIds } },
        },
      },
    }),
    prisma.pointCorrection.count({
      where: { liveQuizId: { in: liveQuizIds } },
    }),
    prisma.groupActivityInstance.count({
      where: { groupActivityId: { in: groupActivityIds } },
    }),
    prisma.activityPerformance.count({
      where: { courseId: course.id },
    }),
    prisma.activityProgress.count({
      where: { courseId: course.id },
    }),
    prisma.participantPerformance.count({
      where: { courseId: course.id },
    }),
    prisma.participantActivityPerformance.count({
      where: {
        OR: [
          { practiceQuizId: { in: practiceQuizIds } },
          { microLearningId: { in: microLearningIds } },
        ],
      },
    }),
    prisma.aggregatedAnalytics.count({
      where: { courseId: course.id },
    }),
    prisma.aggregatedCourseAnalytics.count({
      where: { courseId: course.id },
    }),
    prisma.participantCourseAnalytics.count({
      where: { courseId: course.id },
    }),
  ])

  const mapInstance = (instance: {
    id: number
    elementId: number
    elementData: Prisma.JsonValue
    element: { name: string; content: string }
  }) => {
    const elementData = instance.elementData as {
      content?: string
    } | null

    return {
      instanceId: instance.id,
      elementId: instance.elementId,
      elementName: instance.element.name,
      elementContent: instance.element.content,
      elementDataContent: elementData?.content ?? null,
    }
  }
  const mapBlockActivity = (activity: (typeof liveQuizzes)[number]) => ({
    id: activity.id,
    name: activity.name,
    status: activity.status,
    instances: activity.blocks.flatMap((block) =>
      block.elements.map(mapInstance)
    ),
  })
  const mapStackActivity = (
    activity:
      | (typeof practiceQuizzes)[number]
      | (typeof microLearnings)[number]
      | (typeof groupActivities)[number]
  ) => ({
    id: activity.id,
    name: activity.name,
    status: activity.status,
    instances: activity.stacks.flatMap((stack) =>
      stack.elements.map(mapInstance)
    ),
  })
  const mapPermissionObject = (permission: {
    courseId: string | null
    liveQuizId: string | null
    practiceQuizId: string | null
    microLearningId: string | null
    groupActivityId: string | null
    permissionLevel: PermissionLevel
    propagation?: boolean | null
    derived?: boolean | null
    directPermissionId?: number | null
    userId: string | null
    user?: { shortname: string } | null
    userGroupId?: number | null
    userGroup?: { name: string } | null
  }) => ({
    objectType: permission.courseId
      ? 'COURSE'
      : permission.liveQuizId
        ? 'LIVE_QUIZ'
        : permission.practiceQuizId
          ? 'PRACTICE_QUIZ'
          : permission.microLearningId
            ? 'MICRO_LEARNING'
            : 'GROUP_ACTIVITY',
    objectId:
      permission.courseId ??
      permission.liveQuizId ??
      permission.practiceQuizId ??
      permission.microLearningId ??
      permission.groupActivityId!,
    permissionLevel: permission.permissionLevel,
    propagation: permission.propagation ?? null,
    derived: permission.derived ?? null,
    directPermissionId: permission.directPermissionId ?? null,
    userId: permission.userId,
    userShortname: permission.user?.shortname ?? null,
    userGroupId: permission.userGroupId ?? null,
    userGroupName: permission.userGroup?.name ?? null,
  })
  const [directPermissionDetails, derivedPermissionDetails] = await Promise.all(
    [
      prisma.permission.findMany({
        where: permissionObjectWhere,
        orderBy: { id: 'asc' },
        include: {
          user: { select: { shortname: true } },
          userGroup: { select: { name: true } },
        },
      }),
      prisma.derivedPermission.findMany({
        where: permissionObjectWhere,
        orderBy: { id: 'asc' },
        include: {
          user: { select: { shortname: true } },
        },
      }),
    ]
  )

  return {
    courseId: course.id,
    ownerId: course.ownerId,
    authType: course.authType,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    pinCode: course.pinCode,
    competencyTreeId: course.competencyTree?.id ?? null,
    competencyTreeName: course.competencyTree?.name ?? null,
    liveQuizzes: liveQuizzes.length,
    practiceQuizzes: practiceQuizzes.length,
    microLearnings: microLearnings.length,
    groupActivities: groupActivities.length,
    liveQuizStatuses: liveQuizzes.map((quiz) => quiz.status),
    practiceQuizStatuses: practiceQuizzes.map((quiz) => quiz.status),
    microLearningStatuses: microLearnings.map(
      (microLearning) => microLearning.status
    ),
    groupActivityStatuses: groupActivities.map((activity) => activity.status),
    activityReferences: {
      liveQuizzes: liveQuizzes.map(mapBlockActivity),
      practiceQuizzes: practiceQuizzes.map(mapStackActivity),
      microLearnings: microLearnings.map(mapStackActivity),
      groupActivities: groupActivities.map(mapStackActivity),
    },
    directPermissionDetails: directPermissionDetails.map(mapPermissionObject),
    derivedPermissionDetails: derivedPermissionDetails.map(mapPermissionObject),
    participations,
    participantGroups,
    participantInvitations,
    groupAssignmentPoolEntries,
    directPermissions,
    questionResponses,
    questionResponseDetails,
    liveQuizResponses,
    pointCorrections,
    groupActivityInstances,
    activityPerformances,
    activityProgresses,
    participantPerformances,
    participantActivityPerformances,
    aggregatedAnalytics,
    aggregatedCourseAnalytics,
    participantCourseAnalytics,
  }
}
