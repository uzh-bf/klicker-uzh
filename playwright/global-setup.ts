/**
 * Playwright global setup — mirrors the cypress before:run hook in cypress.config.ts.
 *
 * Runs once before the entire test suite:
 *   1. cleanupDatabase()  – wipe all test data
 *   2. seedDatabase()     – insert baseline users, courses, participants, groups, achievements
 *
 * Individual specs can call seedActivities() if they need the seeded live-quiz /
 * microlearning / practice-quiz / group-activity stubs (mirrors cy.seedActivities()).
 */

import {
  AchievementType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import bcrypt from 'bcryptjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  COURSE_ID_TEST,
  COURSE_ID_TEST2,
  COURSE_ID_TEST3,
  PARTICIPANT_GROUP_IDS,
  PARTICIPANT_GROUP_IDS_SINGLE,
  PARTICIPANT_IDS,
  USER_ID_TEST,
  USER_ID_TEST2,
  USER_ID_TEST3,
  USER_ID_TEST4,
  USER_ID_TEST5,
  USER_ID_TEST6,
  USER_ID_TEST7,
} from './util/constants.js'
import { probeSemanticEvaluatorStub } from './util/semanticEvaluatorStubUrl.js'

const SEMANTIC_EVALUATOR_STUB_URL =
  process.env.CATALYST_FORMATIVE_EVALUATOR_URL ??
  'http://127.0.0.1:7099/evaluate'

const SEMANTIC_EVALUATOR_TOKEN = process.env.CATALYST_FORMATIVE_EVALUATOR_TOKEN

async function waitForSemanticEvaluatorStub(healthUrl: URL) {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        headers: SEMANTIC_EVALUATOR_TOKEN
          ? { authorization: `Bearer ${SEMANTIC_EVALUATOR_TOKEN}` }
          : undefined,
      })
      if (response.ok) return
    } catch {
      // The child process can take a moment to bind its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Semantic evaluator stub did not become ready')
}

async function startSemanticEvaluatorStub() {
  if (process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_STUB === 'false') return
  if (process.env.NODE_ENV !== 'test') {
    if (process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_STUB !== 'true') return
    throw new Error('The semantic evaluator stub requires NODE_ENV=test')
  }

  const { evaluatorUrl, healthUrl, running } = await probeSemanticEvaluatorStub(
    SEMANTIC_EVALUATOR_STUB_URL,
    { token: SEMANTIC_EVALUATOR_TOKEN }
  )
  if (running) {
    throw new Error(
      `Semantic evaluator stub port ${evaluatorUrl.port} is already in use. Stop the other Playwright run before starting this one.`
    )
  }

  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./semantic-evaluator-stub.mjs', import.meta.url))],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PLAYWRIGHT_SEMANTIC_EVALUATOR_PORT: evaluatorUrl.port,
      },
      stdio: 'inherit',
    }
  )
  if (!child.pid) throw new Error('Could not start semantic evaluator stub')
  process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PID = String(child.pid)
  try {
    await waitForSemanticEvaluatorStub(healthUrl)
  } catch (error) {
    child.kill('SIGTERM')
    delete process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PID
    throw error
  }
}

// ---------------------------------------------------------------------------
// getPrisma — lazily import so DATABASE_URL is read at call time, not at
// module load time (the @klicker-uzh/prisma adapter reads it from env on
// construction; importing at the top level would read it before env is set).
// ---------------------------------------------------------------------------
export async function getPrisma() {
  const { prisma } = await import('@klicker-uzh/prisma')
  return prisma
}

export async function ensureDatabaseViews() {
  const prisma = await getPrisma()
  const [{ exists }] = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('"UserActivities"') IS NOT NULL AS exists`
  )

  if (exists) return

  const migrationSql = fs.readFileSync(
    new URL(
      '../packages/prisma/src/prisma/schema/migrations/20250904201500_add_pin_to_user_activities_view/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  const createViewStatement = migrationSql.match(
    /CREATE VIEW "UserActivities" AS[\s\S]*$/m
  )?.[0]

  if (!createViewStatement) {
    throw new Error('Could not load UserActivities view definition')
  }

  await prisma.$executeRawUnsafe(createViewStatement)
}

// ---------------------------------------------------------------------------
// cleanupDatabase — identical logic to cypress.config.ts cleanupDatabase()
// ---------------------------------------------------------------------------
export async function cleanupDatabase() {
  const prisma = await getPrisma()
  try {
    await prisma.participantSemanticEvaluationConsent.deleteMany()

    await prisma.liveQuiz.deleteMany()
    await prisma.microLearning.deleteMany()
    await prisma.practiceQuiz.deleteMany()
    await prisma.groupActivity.deleteMany()

    await prisma.course.deleteMany()

    await prisma.element.deleteMany()
    await prisma.answerCollection.deleteMany()

    await prisma.mediaFile.deleteMany()
    await prisma.catalogCollection.deleteMany()
    await prisma.auditLogEntry.deleteMany()

    await prisma.userGroup.deleteMany()
    await prisma.user.deleteMany()
    await prisma.participantGroup.deleteMany()
    await prisma.participant.deleteMany()

    return true
  } catch (error) {
    throw error
  }
}

// ---------------------------------------------------------------------------
// seedDatabase — identical logic to cypress.config.ts seedDatabase()
// ---------------------------------------------------------------------------
export async function seedDatabase() {
  const prisma = await getPrisma()
  try {
    // Users
    const password = 'abcd'
    const hashedPassword = await bcrypt.hash(password, 12)

    await Promise.all(
      [
        {
          id: USER_ID_TEST,
          name: 'Lecturer',
          email: 'lecturer@df.uzh.ch',
          shortname: 'lecturer',
          catalystIndividual: true,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          aiFeaturesEnabled: true,
          role: UserRole.ADMIN,
          firstLogin: false,
          logins: {
            create: {
              name: 'lecturer',
              password: hashedPassword,
              scope: UserLoginScope.FULL_ACCESS,
            },
          },
        },
        {
          id: USER_ID_TEST2,
          name: 'Free Tier User',
          email: 'free@df.uzh.ch',
          shortname: 'free',
          catalystIndividual: false,
          catalystInstitutional: false,
          publicPreview: false,
          privatePreview: false,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST3,
          name: 'Individual Pro User',
          email: 'pro1@df.uzh.ch',
          shortname: 'pro1',
          catalystIndividual: true,
          catalystInstitutional: false,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST4,
          name: 'Institutional Pro User',
          email: 'pro2@df.uzh.ch',
          shortname: 'pro2',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST5,
          name: 'Institutional Pro User 2',
          email: 'pro3@df.uzh.ch',
          shortname: 'pro3',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST6,
          name: 'Institutional Pro User 3',
          email: 'pro4@df.uzh.ch',
          shortname: 'pro4',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST7,
          name: 'Institutional Pro User 4',
          email: 'pro5@df.uzh.ch',
          shortname: 'pro5',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
      ].map((userData) =>
        prisma.user.upsert({
          where: { id: userData.id },
          create: userData,
          update: {},
        })
      )
    )

    // Courses
    const currentYear = new Date().getFullYear()

    await prisma.course.upsert({
      where: { id: COURSE_ID_TEST },
      create: {
        id: COURSE_ID_TEST,
        name: 'Testkurs',
        displayName: 'Testkurs',
        description: 'Das ist ein Testkurs. Hier wird getestet. Viel Spass!',
        isGamificationEnabled: true,
        color: '#016272',
        pinCode: 123456789,
        startDate: new Date(`${currentYear - 1}-01-01T00:00`),
        endDate: new Date(`${currentYear + 10}-01-01T23:59`),
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date('2021-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: { connect: { id: USER_ID_TEST } },
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: { courseId: COURSE_ID_TEST, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: { connect: { id: COURSE_ID_TEST } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    await prisma.course.upsert({
      where: { id: COURSE_ID_TEST2 },
      create: {
        id: COURSE_ID_TEST2,
        name: 'Testkurs 2',
        displayName: 'Testkurs 2',
        description:
          'Das ist ein abgeschlossener Testkurs. Hier wird getestet. Viel Spass!',
        isGamificationEnabled: true,
        color: '#016272',
        pinCode: 111333555,
        startDate: new Date('2010-01-01T00:00'),
        endDate: new Date('2020-01-01T23:59'),
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date('2015-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: { connect: { id: USER_ID_TEST } },
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: { courseId: COURSE_ID_TEST2, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: { connect: { id: COURSE_ID_TEST2 } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    await prisma.course.upsert({
      where: { id: COURSE_ID_TEST3 },
      create: {
        id: COURSE_ID_TEST3,
        name: 'Non-Gamified Course',
        displayName: 'Non-Gamified Course',
        description: 'This is a course without gamification.',
        isGamificationEnabled: false,
        color: '#166b16',
        pinCode: 482748273,
        startDate: new Date('2023-01-01T00:00'),
        endDate: new Date('2030-01-01T23:59'),
        isGroupCreationEnabled: false,
        groupDeadlineDate: new Date('2025-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: { connect: { id: USER_ID_TEST } },
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: { courseId: COURSE_ID_TEST3, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: { connect: { id: COURSE_ID_TEST3 } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    // Participants (testuser1–testuser50, all enrolled in COURSE_ID_TEST)
    const participantPassword = await bcrypt.hash('abcdabcd', 12)
    await Promise.all(
      PARTICIPANT_IDS.map(async (id, ix) => {
        const username = `testuser${ix + 1}`
        return prisma.participant.upsert({
          where: { id },
          create: {
            id,
            password: participantPassword,
            username,
            email: `${username}@test.uzh.ch`,
            participations: { create: { courseId: COURSE_ID_TEST } },
          },
          update: {},
        })
      })
    )

    // Participant groups (multi-member)
    await Promise.all(
      PARTICIPANT_GROUP_IDS.map(async (id, ix) => {
        const code = 100000 + Math.floor(Math.random() * 900000)
        return prisma.participantGroup.upsert({
          where: { id },
          create: {
            id,
            name: `Gruppe ${ix + 1}`,
            code,
            course: { connect: { id: COURSE_ID_TEST } },
            participants: {
              connect: [
                { id: PARTICIPANT_IDS[ix] },
                { id: PARTICIPANT_IDS[ix + PARTICIPANT_GROUP_IDS.length] },
              ],
            },
            averageMemberScore: Math.round(ix * 100 + 500),
          },
          update: {
            name: `Gruppe ${ix + 1}`,
            code,
          },
        })
      })
    )

    // Participant groups (single-member)
    await Promise.all(
      PARTICIPANT_GROUP_IDS_SINGLE.map(async (id, ix) => {
        const code = 100000 + Math.floor(Math.random() * 900000)
        return prisma.participantGroup.upsert({
          where: { id },
          create: {
            id,
            name: `Single Gruppe ${ix + 1}`,
            code,
            course: { connect: { id: COURSE_ID_TEST } },
            participants: {
              connect: [{ id: PARTICIPANT_IDS[ix + 29] }],
            },
            averageMemberScore: Math.round(ix * 100 + 500),
          },
          update: {
            name: `Single Gruppe ${ix + 1}`,
            code,
          },
        })
      })
    )

    // Top-level catalog collection
    await prisma.catalogCollection.upsert({
      where: { id: 'fde06b3c-d515-4907-99cf-c2ba67583155' },
      create: {
        id: 'fde06b3c-d515-4907-99cf-c2ba67583155',
        name: '',
        access: ObjectAccess.PUBLIC,
      },
      update: { name: '', access: ObjectAccess.PUBLIC },
    })

    // Achievements
    const ACHIEVEMENTS = [
      {
        id: 8,
        nameDE: 'Dream Team',
        nameEN: 'Dream Team',
        descriptionDE:
          'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
        descriptionEN:
          'You have reached more than half of the points in the group task.',
        icon: '/achievements/Dreamteam.svg',
        rewardedPoints: 500,
        rewardedXP: 500,
        type: AchievementType.PARTICIPANT,
      },
      {
        id: 9,
        nameDE: 'Teamgeist',
        nameEN: 'Team Spirit',
        descriptionDE: 'Du hast einen Gruppentask absolviert.',
        descriptionEN: 'You have completed a group task.',
        icon: '/achievements/Teamgeist.svg',
        rewardedPoints: 0,
        rewardedXP: 100,
        type: AchievementType.PARTICIPANT,
      },
    ]
    await Promise.all(
      ACHIEVEMENTS.map((a) =>
        prisma.achievement.upsert({
          where: { id: a.id },
          create: {
            id: a.id,
            nameDE: a.nameDE,
            nameEN: a.nameEN,
            descriptionDE: a.descriptionDE,
            descriptionEN: a.descriptionEN,
            icon: a.icon,
            rewardedPoints: a.rewardedPoints,
            rewardedXP: a.rewardedXP,
            type: a.type,
          },
          update: {
            nameDE: a.nameDE,
            nameEN: a.nameEN,
            descriptionDE: a.descriptionDE,
            descriptionEN: a.descriptionEN,
            icon: a.icon,
            rewardedPoints: a.rewardedPoints,
            rewardedXP: a.rewardedXP,
          },
        })
      )
    )

    return true
  } catch (error) {
    throw error
  }
}

// ---------------------------------------------------------------------------
// seedActivities — mirrors cy.seedActivities() / cypress seedActivities()
// Seed minimal activity stubs needed by workflow specs.
// Call from individual specs via a beforeAll / test.beforeAll.
// ---------------------------------------------------------------------------
export async function seedActivities() {
  const prisma = await getPrisma()
  try {
    const liveQuizId = 'c4196bea-e0c8-49f2-9669-7fdb78bb030c'
    await prisma.liveQuiz.upsert({
      where: { id: liveQuizId },
      create: {
        id: liveQuizId,
        name: 'Seed Live Quiz',
        displayName: 'Seed Live Quiz (Displayname)',
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        liveQuizId_userId: { liveQuizId, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        liveQuiz: { connect: { id: liveQuizId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    const microlearningId = '52a038e5-495e-4262-bd97-f30c3540122a'
    await prisma.microLearning.upsert({
      where: { id: microlearningId },
      create: {
        id: microlearningId,
        name: 'Seed Microlearning',
        displayName: 'Seed Microlearning (Displayname)',
        scheduledStartAt: new Date('2020-01-01T00:00'),
        scheduledEndAt: new Date('2050-01-01T23:59'),
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        microLearningId_userId: {
          microLearningId: microlearningId,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        microLearning: { connect: { id: microlearningId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    const practiceQuizId = '8ef0c8b3-b39d-4a3e-8219-c663a7a36063'
    await prisma.practiceQuiz.upsert({
      where: { id: practiceQuizId },
      create: {
        id: practiceQuizId,
        name: 'Seed Practice Quiz',
        displayName: 'Seed Practice Quiz (Displayname)',
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        practiceQuizId_userId: { practiceQuizId, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        practiceQuiz: { connect: { id: practiceQuizId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    const groupActivityId = '72999654-72b6-47bf-a822-76e1125f4b96'
    await prisma.groupActivity.upsert({
      where: { id: groupActivityId },
      create: {
        id: groupActivityId,
        name: 'Seed Group Activity',
        displayName: 'Seed Group Activity (Displayname)',
        scheduledStartAt: new Date('2020-01-01T00:00'),
        scheduledEndAt: new Date('2050-01-01T23:59'),
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        groupActivityId_userId: { groupActivityId, userId: USER_ID_TEST },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        groupActivity: { connect: { id: groupActivityId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: { permissionLevel: PermissionLevel.OWNER },
    })

    return true
  } catch (error) {
    console.error('Error seeding activities:', error)
    return null
  }
}

export async function seedSemanticPracticeQuiz({
  name,
  displayName,
  description,
  question,
  explanation,
  legacyQuestion,
  legacySolution,
  semanticEvaluation,
}: {
  name: string
  displayName: string
  description: string
  question: string
  explanation: string
  legacyQuestion: string
  legacySolution: string
  semanticEvaluation: SemanticFreeTextConfig
}) {
  const prisma = await getPrisma()
  await Promise.all(
    PARTICIPANT_IDS.slice(0, 7).map((participantId) =>
      prisma.participation.upsert({
        where: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId,
          },
        },
        create: {
          courseId: COURSE_ID_TEST,
          participantId,
          isActive: true,
        },
        update: { isActive: true },
      })
    )
  )
  const semanticOptions = {
    hasSampleSolution: true,
    solutions: semanticEvaluation.accepted_exact_answers,
    semanticEvaluation,
  }
  const legacyOptions = {
    hasSampleSolution: true,
    solutions: [legacySolution],
  }
  const semanticElement = await prisma.element.create({
    data: {
      name: `${name} semantic question`,
      content: question,
      explanation,
      type: ElementType.FREE_TEXT,
      options: semanticOptions,
      ownerId: USER_ID_TEST,
    },
  })
  const legacyElement = await prisma.element.create({
    data: {
      name: `${name} neighboring question`,
      content: legacyQuestion,
      explanation: null,
      type: ElementType.FREE_TEXT,
      options: legacyOptions,
      ownerId: USER_ID_TEST,
    },
  })
  const elementResults = { responses: {}, total: 0 }

  const quiz = await prisma.practiceQuiz.create({
    data: {
      name,
      displayName,
      description,
      status: PublicationStatus.PUBLISHED,
      availableFrom: new Date('2020-01-01T00:00:00.000Z'),
      isGamificationEnabled: true,
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
      stacks: {
        create: {
          order: 0,
          type: ElementStackType.PRACTICE_QUIZ,
          courseId: COURSE_ID_TEST,
          elements: {
            create: [
              {
                order: 0,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementType: ElementType.FREE_TEXT,
                elementId: semanticElement.id,
                ownerId: USER_ID_TEST,
                options: { pointsMultiplier: 1, resetTimeDays: 6 },
                elementData: {
                  id: `${semanticElement.id}-v1`,
                  elementId: semanticElement.id,
                  name: semanticElement.name,
                  content: question,
                  explanation,
                  type: ElementType.FREE_TEXT,
                  basePoints: true,
                  pointsMultiplier: 1,
                  options: semanticOptions,
                },
                results: elementResults,
                anonymousResults: elementResults,
                instanceStatistics: { create: {} },
              },
              {
                order: 1,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementType: ElementType.FREE_TEXT,
                elementId: legacyElement.id,
                ownerId: USER_ID_TEST,
                options: { pointsMultiplier: 1, resetTimeDays: 6 },
                elementData: {
                  id: `${legacyElement.id}-v1`,
                  elementId: legacyElement.id,
                  name: legacyElement.name,
                  content: legacyQuestion,
                  explanation: null,
                  type: ElementType.FREE_TEXT,
                  basePoints: true,
                  pointsMultiplier: 1,
                  options: legacyOptions,
                },
                results: elementResults,
                anonymousResults: elementResults,
                instanceStatistics: { create: {} },
              },
            ],
          },
        },
      },
    },
    include: { stacks: { include: { elements: true } } },
  })

  await prisma.derivedPermission.create({
    data: {
      permissionLevel: PermissionLevel.OWNER,
      practiceQuizId: quiz.id,
      userId: USER_ID_TEST,
    },
  })

  return {
    id: quiz.id,
    courseId: quiz.courseId,
    semanticInstanceId: quiz.stacks[0]!.elements[0]!.id,
  }
}

// ---------------------------------------------------------------------------
// Default export consumed by playwright.config.ts globalSetup
// ---------------------------------------------------------------------------
export default async function globalSetup() {
  try {
    console.log('[global-setup] Starting semantic evaluator stub...')
    await startSemanticEvaluatorStub()
    console.log('[global-setup] Ensuring database views...')
    await ensureDatabaseViews()
    console.log('[global-setup] Cleaning up database...')
    await cleanupDatabase()
    console.log('[global-setup] Seeding database...')
    await seedDatabase()
    console.log('[global-setup] Done.')
  } catch (error) {
    const rawPid = process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PID
    const pid = Number(rawPid)
    if (rawPid && Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch (stopError) {
        if ((stopError as NodeJS.ErrnoException).code !== 'ESRCH') {
          console.error(
            '[global-setup] Could not stop semantic evaluator stub:',
            stopError
          )
        }
      }
      delete process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PID
    }
    throw error
  }
}
