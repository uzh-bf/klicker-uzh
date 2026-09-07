import { createHash, randomUUID } from 'node:crypto'

import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  DataExportStatus,
  ElementInstanceType,
  ElementType,
  PermissionLevel,
  PublicationStatus,
  ResponseCorrectness,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '../src/lib/learningAnalytics.js'
import {
  RESEARCH_EXPORT_DISCLOSURE_VERSION,
  type ResearchExportRequest,
} from '../src/lib/researchExportRequest.js'
import { downloadResearchExport } from '../src/services/dataExports.js'

const TEST_PREFIX = `data-exports-integration-${Date.now()}`
const choiceAt = new Date('2026-09-07T10:00:00.000Z')
const responseAt = new Date('2026-09-07T11:00:00.000Z')

type SyntheticParticipant = {
  id: string
  participationId: number
  learningAnalyticsConsent: boolean
}

type SyntheticFixture = {
  courseId: string
  ownerId: string
  adminId: string
  outsiderId: string
  eligible: SyntheticParticipant
  explicitResearchRefusal: SyntheticParticipant
  unansweredResearch: SyntheticParticipant
  liveInstanceId: number
  asynchronousInstanceId: number
}

const fixtureIds = {
  courses: [] as string[],
  participants: [] as string[],
  users: [] as string[],
  receipts: [] as string[],
}

let fixture: SyntheticFixture

function contextFor(
  userId: string,
  role: UserRole = UserRole.USER,
  scope: UserLoginScope = UserLoginScope.FULL_ACCESS,
  client = prisma
): ContextWithUser {
  return {
    prisma: client,
    user: {
      sub: userId,
      role,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function buildRequest(
  courseId: string,
  overrides: Partial<ResearchExportRequest> = {}
): ResearchExportRequest {
  const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return {
    requestId: randomUUID(),
    courseId,
    projectTitle: 'Synthetic research export',
    responsiblePerson: 'Synthetic researcher',
    contactEmail: 'researcher@example.test',
    purpose: 'Synthetic integration coverage for the research export service',
    deletionDate,
    reference: 'synthetic-reference',
    selectedClasses: ['LIVE_QUIZ_RESPONSES', 'ASYNCHRONOUS_RESPONSES'],
    acknowledgement: true,
    disclosureVersion: RESEARCH_EXPORT_DISCLOSURE_VERSION,
    ...overrides,
  }
}

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-${label}@example.test`,
      shortname: `${TEST_PREFIX}-${label}`,
      role: UserRole.USER,
    },
  })
  fixtureIds.users.push(user.id)
  return user
}

async function createParticipant(
  courseId: string,
  label: string,
  data: {
    researchConsent: boolean
    researchConsentChoiceAt: Date | null
    researchConsentDisclosureVersion: string | null
    learningAnalyticsConsent: boolean
  }
): Promise<SyntheticParticipant> {
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'synthetic-integration-password',
      ...data,
    },
  })
  fixtureIds.participants.push(participant.id)

  const participation = await prisma.participation.create({
    data: {
      courseId,
      participantId: participant.id,
    },
  })

  return {
    id: participant.id,
    participationId: participation.id,
    learningAnalyticsConsent: data.learningAnalyticsConsent,
  }
}

async function createFixture(): Promise<SyntheticFixture> {
  const owner = await createUser('owner')
  const admin = await createUser('admin')
  const outsider = await createUser('outsider')

  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-course`,
      displayName: `${TEST_PREFIX}-course`,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-31T00:00:00.000Z'),
      authType: CourseAuthType.SSO,
      ownerId: owner.id,
    },
  })
  fixtureIds.courses.push(course.id)

  await prisma.permission.create({
    data: {
      userId: admin.id,
      courseId: course.id,
      permissionLevel: PermissionLevel.ADMIN,
    },
  })
  await recomputeDerivedPermissions({ courseId: course.id }, prisma)

  const adminPermission = await prisma.derivedPermission.findUnique({
    where: {
      courseId_userId: {
        courseId: course.id,
        userId: admin.id,
      },
    },
  })
  expect(adminPermission?.permissionLevel).toBe(PermissionLevel.ADMIN)

  const element = await prisma.element.create({
    data: {
      name: `${TEST_PREFIX}-element`,
      content: 'Synthetic element content',
      options: { choices: [] },
      type: ElementType.SC,
      ownerId: admin.id,
    },
  })
  const elementData = processElementData(element)
  const initialResults = getInitialInstanceResults(elementData)
  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${TEST_PREFIX}-practice`,
      displayName: `${TEST_PREFIX}-practice`,
      status: PublicationStatus.PUBLISHED,
      ownerId: admin.id,
      courseId: course.id,
    },
  })
  const liveQuiz = await prisma.liveQuiz.create({
    data: {
      name: `${TEST_PREFIX}-live`,
      displayName: `${TEST_PREFIX}-live`,
      ownerId: admin.id,
      courseId: course.id,
    },
  })
  const elementBlock = await prisma.elementBlock.create({
    data: {
      order: 0,
      liveQuizId: liveQuiz.id,
    },
  })

  const asynchronousInstance = await prisma.elementInstance.create({
    data: {
      type: ElementInstanceType.PRACTICE_QUIZ,
      elementType: ElementType.SC,
      order: 0,
      options: {},
      elementData,
      results: initialResults,
      anonymousResults: initialResults,
      elementId: element.id,
      ownerId: admin.id,
    },
  })
  const liveInstance = await prisma.elementInstance.create({
    data: {
      type: ElementInstanceType.LIVE_QUIZ,
      elementType: ElementType.SC,
      order: 0,
      options: {},
      elementData,
      results: initialResults,
      anonymousResults: initialResults,
      elementId: element.id,
      elementBlockId: elementBlock.id,
      ownerId: admin.id,
    },
  })

  const eligible = await createParticipant(course.id, 'eligible', {
    researchConsent: true,
    researchConsentChoiceAt: choiceAt,
    researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    learningAnalyticsConsent: false,
  })
  const explicitResearchRefusal = await createParticipant(
    course.id,
    'research-refused-la-true',
    {
      researchConsent: false,
      researchConsentChoiceAt: choiceAt,
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsConsent: true,
    }
  )
  const unansweredResearch = await createParticipant(
    course.id,
    'research-unanswered-la-false',
    {
      researchConsent: false,
      researchConsentChoiceAt: null,
      researchConsentDisclosureVersion: null,
      learningAnalyticsConsent: false,
    }
  )

  for (const participant of [
    eligible,
    explicitResearchRefusal,
    unansweredResearch,
  ]) {
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: responseAt,
        response: { choices: [{ ix: 0, selected: true }] },
        timeSpent: 4,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 1,
        correctnessPoints: 2,
        bonusPoints: 0,
        instanceId: liveInstance.id,
        elementBlockExecution: 0,
        participantId: participant.id,
      },
    })
    await prisma.questionResponseDetail.create({
      data: {
        score: 1,
        pointsAwarded: 2,
        timeSpent: 4,
        response: { choices: [{ ix: 0, selected: true }] },
        participantId: participant.id,
        participationId: participant.participationId,
        elementInstanceId: asynchronousInstance.id,
        practiceQuizId: practiceQuiz.id,
        createdAt: responseAt,
      },
    })
  }

  return {
    courseId: course.id,
    ownerId: owner.id,
    adminId: admin.id,
    outsiderId: outsider.id,
    eligible,
    explicitResearchRefusal,
    unansweredResearch,
    liveInstanceId: liveInstance.id,
    asynchronousInstanceId: asynchronousInstance.id,
  }
}

async function cleanupFixture() {
  await requireDisposableDatabase(prisma)
  if (fixtureIds.receipts.length > 0) {
    await prisma.researchExportReceipt.deleteMany({
      where: { id: { in: fixtureIds.receipts } },
    })
  }
  if (fixtureIds.courses.length > 0) {
    await prisma.course.deleteMany({
      where: { id: { in: fixtureIds.courses } },
    })
  }
  if (fixtureIds.participants.length > 0) {
    await prisma.participant.deleteMany({
      where: { id: { in: fixtureIds.participants } },
    })
  }
  if (fixtureIds.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: fixtureIds.users } } })
  }
}

describe('research export PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
    fixture = await createFixture()
  })

  afterAll(async () => {
    await cleanupFixture()
    await prisma.$disconnect()
  })

  it('rejects unauthorized and restricted sessions without creating receipts', async () => {
    const attempts = [
      {
        context: contextFor(fixture.outsiderId),
        request: buildRequest(fixture.courseId),
      },
      {
        context: contextFor(
          fixture.adminId,
          UserRole.USER,
          UserLoginScope.READ_ONLY
        ),
        request: buildRequest(fixture.courseId),
      },
      {
        context: contextFor(
          fixture.eligible.id,
          UserRole.PARTICIPANT,
          UserLoginScope.FULL_ACCESS
        ),
        request: buildRequest(fixture.courseId),
      },
    ]

    for (const { context, request } of attempts) {
      await expect(
        downloadResearchExport(request, context)
      ).rejects.toMatchObject({ extensions: { code: 'DATA_EXPORT_FORBIDDEN' } })
      expect(
        await prisma.researchExportReceipt.findUnique({
          where: { id: request.requestId },
        })
      ).toBeNull()
    }
  })

  it('releases an exact receipt and strips structural participant IDs', async () => {
    const request = buildRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)

    const result = await downloadResearchExport(
      request,
      contextFor(fixture.adminId)
    )
    const expectedSha256 = createHash('sha256')
      .update(result.body, 'utf8')
      .digest('hex')
    const expectedByteCount = Buffer.byteLength(result.body, 'utf8')
    const document = JSON.parse(result.body) as {
      manifest: {
        exportId: string
        courseId: string
        selectedClasses: string[]
      }
      LIVE_QUIZ_RESPONSES: Array<Record<string, unknown>>
      ASYNCHRONOUS_RESPONSES: Array<Record<string, unknown>>
    }

    expect(result.exportId).toBe(request.requestId)
    expect(result.sha256).toBe(expectedSha256)
    expect(result.byteCount).toBe(expectedByteCount)
    expect(result.recordCount).toBe(2)
    expect(document.manifest).toMatchObject({
      exportId: request.requestId,
      courseId: fixture.courseId,
      selectedClasses: request.selectedClasses,
    })
    expect(document.LIVE_QUIZ_RESPONSES).toHaveLength(1)
    expect(document.ASYNCHRONOUS_RESPONSES).toHaveLength(1)

    for (const row of [
      ...document.LIVE_QUIZ_RESPONSES,
      ...document.ASYNCHRONOUS_RESPONSES,
    ]) {
      expect(row).toHaveProperty('participantKey')
      expect(row).not.toHaveProperty('participantId')
    }
    for (const participant of [
      fixture.eligible,
      fixture.explicitResearchRefusal,
      fixture.unansweredResearch,
    ]) {
      expect(result.body).not.toContain(participant.id)
    }

    const receipt = await prisma.researchExportReceipt.findUnique({
      where: { id: request.requestId },
    })
    expect(receipt).toMatchObject({
      id: request.requestId,
      requesterId: fixture.adminId,
      courseId: fixture.courseId,
      status: DataExportStatus.RELEASED,
      sha256: expectedSha256,
      byteCount: expectedByteCount,
      recordCount: 2,
      failureCode: null,
    })
    expect(receipt?.releasedAt).toBeInstanceOf(Date)
  })

  it('excludes explicit and unanswered research consent independently of LA consent', async () => {
    expect(fixture.explicitResearchRefusal.learningAnalyticsConsent).toBe(true)
    expect(fixture.unansweredResearch.learningAnalyticsConsent).toBe(false)
    expect(fixture.eligible.learningAnalyticsConsent).toBe(false)

    const request = buildRequest(fixture.courseId, {
      selectedClasses: ['ASYNCHRONOUS_RESPONSES'],
    })
    fixtureIds.receipts.push(request.requestId)

    const result = await downloadResearchExport(
      request,
      contextFor(fixture.adminId)
    )

    expect(result.recordCount).toBe(1)
    expect(JSON.parse(result.body).ASYNCHRONOUS_RESPONSES).toHaveLength(1)
    expect(result.body).not.toContain(fixture.explicitResearchRefusal.id)
    expect(result.body).not.toContain(fixture.unansweredResearch.id)
  })

  it('fails when eligible consent is withdrawn after live rows are read', async () => {
    const request = buildRequest(fixture.courseId, {
      selectedClasses: ['LIVE_QUIZ_RESPONSES'],
    })
    fixtureIds.receipts.push(request.requestId)
    let liveRowsRead = false
    const withdrawingPrisma = prisma.$extends({
      query: {
        liveQuizResponse: {
          async findMany({ args, query }) {
            const rows = await query(args)
            if (rows.some((row) => row.participantId === fixture.eligible.id)) {
              await prisma.participant.update({
                where: { id: fixture.eligible.id },
                data: {
                  researchConsent: false,
                  researchConsentChoiceAt: null,
                  researchConsentDisclosureVersion: null,
                },
              })
              liveRowsRead = true
            }
            return rows
          },
        },
      },
    })

    try {
      await expect(
        downloadResearchExport(
          request,
          contextFor(
            fixture.adminId,
            UserRole.USER,
            UserLoginScope.FULL_ACCESS,
            withdrawingPrisma as unknown as typeof prisma
          )
        )
      ).rejects.toMatchObject({
        extensions: { code: 'DATA_EXPORT_ELIGIBILITY_CHANGED' },
      })

      expect(liveRowsRead).toBe(true)
      await expect(
        prisma.researchExportReceipt.findUnique({
          where: { id: request.requestId },
        })
      ).resolves.toMatchObject({
        status: DataExportStatus.FAILED,
        sha256: null,
        byteCount: null,
        recordCount: null,
        failureCode: 'DATA_EXPORT_ELIGIBILITY_CHANGED',
        releasedAt: null,
      })
    } finally {
      await prisma.participant.update({
        where: { id: fixture.eligible.id },
        data: {
          researchConsent: true,
          researchConsentChoiceAt: choiceAt,
          researchConsentDisclosureVersion:
            PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
      })
    }
  })

  it('rejects reuse of a requestId after the first receipt is released', async () => {
    const request = buildRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)

    await expect(
      downloadResearchExport(request, contextFor(fixture.adminId))
    ).resolves.toMatchObject({ exportId: request.requestId })
    await expect(
      downloadResearchExport(request, contextFor(fixture.adminId))
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_REQUEST_ALREADY_USED' },
    })
    expect(
      await prisma.researchExportReceipt.count({
        where: { id: request.requestId },
      })
    ).toBe(1)
    await expect(
      prisma.researchExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({ status: DataExportStatus.RELEASED })
  })

  it('returns no artifact when the release receipt write fails', async () => {
    const request = buildRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const failingPrisma = prisma.$extends({
      query: {
        researchExportReceipt: {
          async update({ args, query }) {
            if (args.data.status === DataExportStatus.RELEASED) {
              throw new Error('Synthetic release receipt write failure')
            }
            return query(args)
          },
        },
      },
    })

    await expect(
      downloadResearchExport(
        request,
        contextFor(
          fixture.adminId,
          UserRole.USER,
          UserLoginScope.FULL_ACCESS,
          failingPrisma as unknown as typeof prisma
        )
      )
    ).rejects.toThrow('Synthetic release receipt write failure')

    await expect(
      prisma.researchExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({
      status: DataExportStatus.FAILED,
      sha256: null,
      byteCount: null,
      recordCount: null,
      failureCode: 'DATA_EXPORT_FAILED',
      releasedAt: null,
    })
  })

  it('persists cancellation during preparation as a failed receipt', async () => {
    const request = buildRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const cancellation = new AbortController()
    const cancelAfterReceiptPrisma = prisma.$extends({
      query: {
        researchExportReceipt: {
          async create({ args, query }) {
            const receipt = await query(args)
            if (args.data.id === request.requestId) cancellation.abort()
            return receipt
          },
        },
      },
    })

    await expect(
      downloadResearchExport(
        request,
        contextFor(
          fixture.adminId,
          UserRole.USER,
          UserLoginScope.FULL_ACCESS,
          cancelAfterReceiptPrisma as unknown as typeof prisma
        ),
        cancellation.signal
      )
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_CANCELLED' },
    })

    expect(cancellation.signal.aborted).toBe(true)
    await expect(
      prisma.researchExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({
      status: DataExportStatus.FAILED,
      sha256: null,
      byteCount: null,
      recordCount: null,
      failureCode: 'DATA_EXPORT_CANCELLED',
      releasedAt: null,
    })
  })

  it('fails when admin course permission is revoked after receipt creation', async () => {
    const request = buildRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    let receiptCreated = false
    const revokingPrisma = prisma.$extends({
      query: {
        researchExportReceipt: {
          async create({ args, query }) {
            const receipt = await query(args)
            if (args.data.id === request.requestId) {
              await prisma.derivedPermission.update({
                where: {
                  courseId_userId: {
                    courseId: fixture.courseId,
                    userId: fixture.adminId,
                  },
                },
                data: { permissionLevel: PermissionLevel.READ },
              })
              receiptCreated = true
            }
            return receipt
          },
        },
      },
    })

    try {
      await expect(
        downloadResearchExport(
          request,
          contextFor(
            fixture.adminId,
            UserRole.USER,
            UserLoginScope.FULL_ACCESS,
            revokingPrisma as unknown as typeof prisma
          )
        )
      ).rejects.toMatchObject({
        extensions: { code: 'DATA_EXPORT_FORBIDDEN' },
      })

      expect(receiptCreated).toBe(true)
      await expect(
        prisma.researchExportReceipt.findUnique({
          where: { id: request.requestId },
        })
      ).resolves.toMatchObject({
        status: DataExportStatus.FAILED,
        sha256: null,
        byteCount: null,
        recordCount: null,
        failureCode: 'DATA_EXPORT_FORBIDDEN',
        releasedAt: null,
      })
    } finally {
      await prisma.derivedPermission.update({
        where: {
          courseId_userId: {
            courseId: fixture.courseId,
            userId: fixture.adminId,
          },
        },
        data: { permissionLevel: PermissionLevel.ADMIN },
      })
    }

    await expect(
      prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: fixture.courseId,
            userId: fixture.adminId,
          },
        },
      })
    ).resolves.toMatchObject({ permissionLevel: PermissionLevel.ADMIN })
  })

  it('explicitly denies a known but unavailable export class', async () => {
    const request = buildRequest(fixture.courseId, {
      selectedClasses: ['LEARNING_ANALYTICS'],
    })

    await expect(
      downloadResearchExport(request, contextFor(fixture.adminId))
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_CLASS_UNAVAILABLE' },
    })
    await expect(
      prisma.researchExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toBeNull()
  })
})
