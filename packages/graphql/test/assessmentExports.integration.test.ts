import { createHash, randomUUID } from 'node:crypto'

import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  DataExportStatus,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { parse } from 'csv-parse/sync'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ASSESSMENT_EXPORT_DISCLOSURE_VERSION,
  type AssessmentExportRequest,
} from '../src/lib/assessmentExportRequest.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { downloadAssessmentExport } from '../src/services/assessmentExports.js'

const TEST_PREFIX = `assessment-exports-integration-${Date.now()}`

type CourseExportRequest = Extract<AssessmentExportRequest, { scope: 'COURSE' }>
type LiveQuizExportRequest = Extract<
  AssessmentExportRequest,
  { scope: 'LIVE_QUIZ' }
>

type SyntheticFixture = {
  courseId: string
  otherCourseId: string
  adminId: string
  outsiderId: string
  otherLiveQuizId: string
  participantId: string
}

const fixtureIds = {
  courses: [] as string[],
  liveQuizzes: [] as string[],
  participants: [] as string[],
  receipts: [] as string[],
  users: [] as string[],
}

let fixture: SyntheticFixture

function contextFor(
  userId: string,
  scope: UserLoginScope = UserLoginScope.FULL_ACCESS,
  role: UserRole = UserRole.USER,
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

function buildCourseRequest(
  courseId: string,
  overrides: Partial<CourseExportRequest> = {}
): CourseExportRequest {
  return {
    requestId: randomUUID(),
    courseId,
    scope: 'COURSE',
    locale: 'en',
    disclosureVersion: ASSESSMENT_EXPORT_DISCLOSURE_VERSION,
    acknowledgement: true,
    ...overrides,
  }
}

function buildLiveQuizRequest(
  courseId: string,
  liveQuizId: string
): LiveQuizExportRequest {
  return {
    ...buildCourseRequest(courseId),
    scope: 'LIVE_QUIZ',
    liveQuizId,
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

async function createAssessmentCourse(ownerId: string, label: string) {
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${label}`,
      displayName: `${TEST_PREFIX}-${label}`,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-31T00:00:00.000Z'),
      authType: CourseAuthType.SSO,
      isAssessmentEnabled: true,
      ownerId,
    },
  })
  fixtureIds.courses.push(course.id)
  return course
}

async function createFixture(): Promise<SyntheticFixture> {
  const owner = await createUser('owner')
  const admin = await createUser('admin')
  const outsider = await createUser('outsider')

  const course = await createAssessmentCourse(owner.id, 'course')
  const otherCourse = await createAssessmentCourse(owner.id, 'other-course')

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

  const participant = await prisma.participant.create({
    data: {
      email: `${TEST_PREFIX}-student@example.test`,
      username: `${TEST_PREFIX}-student`,
      password: 'synthetic-integration-password',
    },
  })
  fixtureIds.participants.push(participant.id)

  await prisma.participation.create({
    data: {
      courseId: course.id,
      participantId: participant.id,
      assessmentGivenName: 'Synthetic',
      assessmentSurname: 'Student',
      assessmentMatriculationNumber: 'SYNTH-001',
    },
  })

  const otherLiveQuiz = await prisma.liveQuiz.create({
    data: {
      name: `${TEST_PREFIX}-other-live-quiz`,
      pinCode: randomUUID(),
      displayName: `${TEST_PREFIX}-other-live-quiz`,
      ownerId: admin.id,
      courseId: otherCourse.id,
      isAssessmentEnabled: true,
    },
  })
  fixtureIds.liveQuizzes.push(otherLiveQuiz.id)

  return {
    courseId: course.id,
    otherCourseId: otherCourse.id,
    adminId: admin.id,
    outsiderId: outsider.id,
    otherLiveQuizId: otherLiveQuiz.id,
    participantId: participant.id,
  }
}

async function cleanupFixture() {
  await requireDisposableDatabase(prisma)
  if (fixtureIds.receipts.length > 0) {
    await prisma.assessmentExportReceipt.deleteMany({
      where: { id: { in: fixtureIds.receipts } },
    })
  }
  if (fixtureIds.liveQuizzes.length > 0) {
    await prisma.liveQuiz.deleteMany({
      where: { id: { in: fixtureIds.liveQuizzes } },
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

describe('assessment export PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
    fixture = await createFixture()
  })

  afterAll(async () => {
    await cleanupFixture()
    await prisma.$disconnect()
  })

  it('releases an exact course CSV and audit receipt for zero assessment scores', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)

    const result = await downloadAssessmentExport(
      request,
      contextFor(fixture.adminId)
    )
    const rows = parse(result.body, {
      columns: false,
      bom: true,
      delimiter: ';',
    }) as string[][]
    const expectedSha256 = createHash('sha256')
      .update(result.body, 'utf8')
      .digest('hex')
    const expectedByteCount = Buffer.byteLength(result.body, 'utf8')

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.length === 8)).toBe(true)
    expect(rows[1]).toEqual([
      `${TEST_PREFIX}-student@example.test`,
      'Synthetic',
      'Student',
      'SYNTH-001',
      '0',
      '0',
      '0',
      '0',
    ])
    expect(result).toMatchObject({
      sha256: expectedSha256,
      byteCount: expectedByteCount,
      recordCount: 1,
      exportId: request.requestId,
    })
    expect(result.body).not.toContain(fixture.participantId)

    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({
      id: request.requestId,
      requesterId: fixture.adminId,
      courseId: fixture.courseId,
      liveQuizId: null,
      locale: 'en',
      disclosureVersion: ASSESSMENT_EXPORT_DISCLOSURE_VERSION,
      status: DataExportStatus.RELEASED,
      sha256: expectedSha256,
      byteCount: expectedByteCount,
      recordCount: 1,
      failureCode: null,
    })
    const receipt = await prisma.assessmentExportReceipt.findUnique({
      where: { id: request.requestId },
    })
    expect(receipt?.attestedAt).toBeInstanceOf(Date)
    expect(receipt?.releasedAt).toBeInstanceOf(Date)
    expect(receipt!.releasedAt!.getTime()).toBeGreaterThanOrEqual(
      receipt!.attestedAt.getTime()
    )
  })

  it('denies an outsider and a restricted session without creating receipts', async () => {
    const attempts = [
      {
        context: contextFor(fixture.outsiderId),
        request: buildCourseRequest(fixture.courseId),
      },
      {
        context: contextFor(fixture.adminId, UserLoginScope.READ_ONLY),
        request: buildCourseRequest(fixture.courseId),
      },
    ]

    for (const { context, request } of attempts) {
      fixtureIds.receipts.push(request.requestId)
      await expect(
        downloadAssessmentExport(request, context)
      ).rejects.toMatchObject({
        extensions: { code: 'DATA_EXPORT_FORBIDDEN' },
      })
      await expect(
        prisma.assessmentExportReceipt.findUnique({
          where: { id: request.requestId },
        })
      ).resolves.toBeNull()
    }
  })

  it('rejects an invalid attestation without creating a receipt', async () => {
    const validRequest = buildCourseRequest(fixture.courseId)
    const request = { ...validRequest, acknowledgement: false }
    fixtureIds.receipts.push(request.requestId)

    await expect(
      downloadAssessmentExport(request, contextFor(fixture.adminId))
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_INVALID_REQUEST' },
    })
    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toBeNull()
  })

  it('fails when admin course permission is revoked after receipt creation', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    let receiptCreated = false
    const revokingPrisma = prisma.$extends({
      query: {
        assessmentExportReceipt: {
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
        downloadAssessmentExport(
          request,
          contextFor(
            fixture.adminId,
            UserLoginScope.FULL_ACCESS,
            UserRole.USER,
            revokingPrisma as unknown as typeof prisma
          )
        )
      ).rejects.toMatchObject({
        extensions: { code: 'DATA_EXPORT_FORBIDDEN' },
      })

      expect(receiptCreated).toBe(true)
      await expect(
        prisma.assessmentExportReceipt.findUnique({
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

  it('rejects a duplicate request ID after releasing the first export', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)

    await expect(
      downloadAssessmentExport(request, contextFor(fixture.adminId))
    ).resolves.toMatchObject({ exportId: request.requestId })
    await expect(
      downloadAssessmentExport(request, contextFor(fixture.adminId))
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_REQUEST_ALREADY_USED' },
    })
    await expect(
      prisma.assessmentExportReceipt.count({
        where: { id: request.requestId },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({ status: DataExportStatus.RELEASED })
  })

  it('fails closed when the database release clock is unavailable', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const failingPrisma = prisma.$extends({
      query: {
        async $queryRaw({ args, query }) {
          if (args.strings.join('').includes('clock_timestamp()')) return []
          return query(args)
        },
      },
    })

    await expect(
      downloadAssessmentExport(
        request,
        contextFor(
          fixture.adminId,
          UserLoginScope.FULL_ACCESS,
          UserRole.USER,
          failingPrisma as unknown as typeof prisma
        )
      )
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_CLOCK_FAILURE' },
    })
    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({
      status: DataExportStatus.FAILED,
      sha256: null,
      releasedAt: null,
      failureCode: 'DATA_EXPORT_CLOCK_FAILURE',
    })
  })

  it('records a failed audit receipt when the release write fails', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const failingPrisma = prisma.$extends({
      query: {
        assessmentExportReceipt: {
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
      downloadAssessmentExport(
        request,
        contextFor(
          fixture.adminId,
          UserLoginScope.FULL_ACCESS,
          UserRole.USER,
          failingPrisma as unknown as typeof prisma
        )
      )
    ).rejects.toThrow('Synthetic release receipt write failure')

    await expect(
      prisma.assessmentExportReceipt.findUnique({
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

  it('records cancellation during release receipt write as a failed audit receipt', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const cancellation = new AbortController()
    const cancelAfterReleasePrisma = prisma.$extends({
      query: {
        assessmentExportReceipt: {
          async update({ args, query }) {
            const receipt = await query(args)
            if (args.data.status === DataExportStatus.RELEASED) {
              cancellation.abort()
            }
            return receipt
          },
        },
      },
    })

    await expect(
      downloadAssessmentExport(
        request,
        contextFor(
          fixture.adminId,
          UserLoginScope.FULL_ACCESS,
          UserRole.USER,
          cancelAfterReleasePrisma as unknown as typeof prisma
        ),
        cancellation.signal
      )
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_CANCELLED' },
    })

    await expect(
      prisma.assessmentExportReceipt.findUnique({
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

  it('cancels before database work without creating a receipt', async () => {
    const request = buildCourseRequest(fixture.courseId)
    fixtureIds.receipts.push(request.requestId)
    const cancellation = new AbortController()
    cancellation.abort()

    await expect(
      downloadAssessmentExport(
        request,
        contextFor(fixture.adminId),
        cancellation.signal
      )
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_CANCELLED' },
    })
    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toBeNull()
  })

  it('rejects a live quiz from another course as forbidden', async () => {
    const request = buildLiveQuizRequest(
      fixture.courseId,
      fixture.otherLiveQuizId
    )
    fixtureIds.receipts.push(request.requestId)

    await expect(
      downloadAssessmentExport(request, contextFor(fixture.adminId))
    ).rejects.toMatchObject({
      extensions: { code: 'DATA_EXPORT_FORBIDDEN' },
    })
    await expect(
      prisma.assessmentExportReceipt.findUnique({
        where: { id: request.requestId },
      })
    ).resolves.toMatchObject({
      courseId: fixture.courseId,
      liveQuizId: fixture.otherLiveQuizId,
      status: DataExportStatus.FAILED,
      sha256: null,
      byteCount: null,
      recordCount: null,
      failureCode: 'DATA_EXPORT_FORBIDDEN',
      releasedAt: null,
    })
  })
})
