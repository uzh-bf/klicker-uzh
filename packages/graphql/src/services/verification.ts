import * as DB from '@klicker-uzh/prisma/client'
import type { AssessmentReportSnapshotV1 } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { Context, ContextWithUser } from '../lib/context.js'
import {
  hashAssessmentReportSnapshot,
  parseAssessmentReportSnapshot,
} from './assessmentReports.js'
import { checkAccess } from './sharing.js'

const VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/

const courseAssessmentReportRecordSelect = {
  id: true,
  token: true,
  courseId: true,
  subjectEmail: true,
  status: true,
  issuedAt: true,
  revokedAt: true,
  supersededAt: true,
} satisfies DB.Prisma.VerifiableCredentialSelect

export type PublicAssessmentReportVerification =
  | {
      status: typeof DB.CredentialStatus.ACTIVE
      issuedAt: Date
      snapshot: AssessmentReportSnapshotV1
    }
  | {
      status:
        | Exclude<DB.CredentialStatus, typeof DB.CredentialStatus.ACTIVE>
        | 'DATA_UNAVAILABLE'
      issuedAt: Date
      snapshot: null
    }

export type CourseAssessmentReportRecord =
  DB.Prisma.VerifiableCredentialGetPayload<{
    select: typeof courseAssessmentReportRecordSelect
  }>

export type CourseAssessmentReportRecordPage = {
  totalCount: number
  records: CourseAssessmentReportRecord[]
}

function forbiddenError() {
  return new GraphQLError('FORBIDDEN', {
    extensions: { code: 'FORBIDDEN' },
  })
}

function requireFullAccess(ctx: ContextWithUser) {
  if (
    ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER &&
    ctx.user.scope !== DB.UserLoginScope.FULL_ACCESS
  ) {
    throw forbiddenError()
  }
}

async function requireCourseAdminAccess(
  courseId: string,
  ctx: ContextWithUser
) {
  const hasAdminAccess = await checkAccess(
    [{ courseId, minimumPermissionLevel: DB.PermissionLevel.ADMIN }],
    ctx
  )
  if (!hasAdminAccess) throw forbiddenError()
}

export async function getPublicAssessmentReport(
  { token }: { token: string },
  ctx: Context
): Promise<PublicAssessmentReportVerification | null> {
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) return null

  const record = await ctx.prisma.verifiableCredential.findUnique({
    where: { token },
    select: {
      status: true,
      issuedAt: true,
      snapshot: true,
      snapshotVersion: true,
      snapshotHash: true,
    },
  })
  if (!record) return null

  if (record.status !== DB.CredentialStatus.ACTIVE) {
    return { status: record.status, issuedAt: record.issuedAt, snapshot: null }
  }

  const snapshot = parseAssessmentReportSnapshot(record)
  if (
    !snapshot ||
    hashAssessmentReportSnapshot(snapshot) !== record.snapshotHash
  ) {
    return {
      status: 'DATA_UNAVAILABLE',
      issuedAt: record.issuedAt,
      snapshot: null,
    }
  }

  return { status: record.status, issuedAt: record.issuedAt, snapshot }
}

export async function getCourseAssessmentReportRecords(
  {
    courseId,
    statusFilter,
    searchString,
    numEntries = 20,
    offset = 0,
  }: {
    courseId: string
    statusFilter?: DB.CredentialStatus[] | null
    searchString?: string | null
    numEntries?: number | null
    offset?: number | null
  },
  ctx: ContextWithUser
): Promise<CourseAssessmentReportRecordPage> {
  requireFullAccess(ctx)
  await requireCourseAdminAccess(courseId, ctx)

  const where: DB.Prisma.VerifiableCredentialWhereInput = {
    courseId,
    type: DB.CredentialType.COURSE_ASSESSMENT_INSIGHTS,
    status: statusFilter?.length ? { in: statusFilter } : undefined,
    subjectEmail: searchString?.trim()
      ? { contains: searchString.trim(), mode: 'insensitive' }
      : undefined,
  }
  const [records, totalCount] = await Promise.all([
    ctx.prisma.verifiableCredential.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(numEntries ?? 20, 1), 100),
      skip: Math.max(offset ?? 0, 0),
      select: courseAssessmentReportRecordSelect,
    }),
    ctx.prisma.verifiableCredential.count({ where }),
  ])

  return { records, totalCount }
}

export async function getCourseAssessmentReportRecordCount(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  requireFullAccess(ctx)
  await requireCourseAdminAccess(courseId, ctx)
  return await ctx.prisma.verifiableCredential.count({
    where: {
      courseId,
      type: DB.CredentialType.COURSE_ASSESSMENT_INSIGHTS,
    },
  })
}

export async function revokeAssessmentReport(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  requireFullAccess(ctx)

  const record = await ctx.prisma.verifiableCredential.findFirst({
    where: {
      id,
      type: DB.CredentialType.COURSE_ASSESSMENT_INSIGHTS,
    },
    select: courseAssessmentReportRecordSelect,
  })

  // Authorize before revealing whether the record exists: a caller without
  // admin access on the record's course gets the same outcome as a
  // non-existent id, so credential ids cannot be used as an existence oracle
  // across courses the caller does not administer.
  const hasAdminAccess = record
    ? await checkAccess(
        [
          {
            courseId: record.courseId,
            minimumPermissionLevel: DB.PermissionLevel.ADMIN,
          },
        ],
        ctx
      )
    : false
  if (!record || !hasAdminAccess) {
    throw new GraphQLError('ASSESSMENT_REPORT_NOT_FOUND', {
      extensions: { code: 'NOT_FOUND' },
    })
  }

  if (record.status !== DB.CredentialStatus.ACTIVE) return record

  const revokedAt = new Date()
  const result = await ctx.prisma.verifiableCredential.updateMany({
    where: { id, status: DB.CredentialStatus.ACTIVE },
    data: {
      status: DB.CredentialStatus.REVOKED,
      revokedAt,
      revokedById: ctx.user.sub,
    },
  })
  if (result.count === 0) {
    return await ctx.prisma.verifiableCredential.findUniqueOrThrow({
      where: { id },
      select: courseAssessmentReportRecordSelect,
    })
  }
  return {
    ...record,
    status: DB.CredentialStatus.REVOKED,
    revokedAt,
  }
}
