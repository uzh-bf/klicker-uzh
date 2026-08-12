import {
  type AuditTransactionClient,
  runInAuditTransaction,
} from '@klicker-uzh/audit'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  AssessmentReportHistogramBin,
  AssessmentReportSnapshot,
  AssessmentReportSnapshotV1,
} from '@klicker-uzh/types'
import {
  normalizeEmail,
  normalizeIdentityValue,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { createHash, randomBytes } from 'crypto'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'
import {
  type AssessmentAuditOperation,
  assessmentAuditParticipantOperation,
  emitCoveredCourseAssessmentAuditEvents,
} from './assessmentAuditProducers.js'
import { calculateAssessmentCourseScores } from './assessmentScores.js'

const MINIMUM_COMPARISON_COHORT_SIZE = 10
const MINIMUM_HISTOGRAM_BIN_SIZE = 3
const HISTOGRAM_BASE_BIN_COUNT = 10
const TRANSACTION_RETRY_LIMIT = 3
const TRANSACTION_MAX_WAIT_MS = 5_000
const TRANSACTION_TIMEOUT_MS = 15_000

const finiteNumberSchema = z.number().finite()
const nonnegativeNumberSchema = finiteNumberSchema.nonnegative()
const normalizedEmailSchema = z
  .string()
  .refine(
    (email) => normalizeEmail(email) === email,
    'The email must be normalized and valid'
  )

const histogramBinSchema = z
  .object({
    binStart: nonnegativeNumberSchema,
    binEnd: nonnegativeNumberSchema,
    count: z.number().int().min(MINIMUM_HISTOGRAM_BIN_SIZE),
  })
  .strict()

const assessmentReportComparisonSchema = z
  .object({
    cohortSize: z.number().int().min(MINIMUM_COMPARISON_COHORT_SIZE),
    percentile: z.number().int().min(0).max(100),
    histogram: z.array(histogramBinSchema).min(1),
  })
  .strict()
  .nullable()

const nullableIdentityValueSchema = z.string().trim().min(1).nullable()

type AssessmentReportScoredFields = {
  results: {
    basePoints: number
    availableBasePoints: number
    correctnessPoints: number
    availableCorrectnessPoints: number
    bonusPoints: number
    availableBonusPoints: number
    totalPoints: number
    availableTotalPoints: number
  }
  comparison: z.infer<typeof assessmentReportComparisonSchema>
}

function validateAssessmentReportSnapshot(
  snapshot: AssessmentReportScoredFields,
  ctx: z.RefinementCtx
) {
  const expectedTotal =
    snapshot.results.basePoints +
    snapshot.results.correctnessPoints +
    snapshot.results.bonusPoints
  const expectedAvailableTotal =
    snapshot.results.availableBasePoints +
    snapshot.results.availableCorrectnessPoints +
    snapshot.results.availableBonusPoints

  if (snapshot.results.totalPoints !== expectedTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The total score does not match its components',
      path: ['results', 'totalPoints'],
    })
  }
  if (snapshot.results.availableTotalPoints !== expectedAvailableTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The available total does not match its components',
      path: ['results', 'availableTotalPoints'],
    })
  }

  if (snapshot.comparison) {
    const histogramCount = snapshot.comparison.histogram.reduce(
      (count, bin) => count + bin.count,
      0
    )
    if (histogramCount !== snapshot.comparison.cohortSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The histogram does not match the cohort size',
        path: ['comparison', 'histogram'],
      })
    }

    snapshot.comparison.histogram.forEach((bin, index, bins) => {
      const previous = bins[index - 1]
      if (
        bin.binEnd <= bin.binStart ||
        (previous && bin.binStart !== previous.binEnd)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The histogram boundaries are invalid',
          path: ['comparison', 'histogram', index],
        })
      }
    })
  }
}

const assessmentReportCourseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().min(1),
  })
  .strict()

const assessmentReportResultsSchema = z
  .object({
    basePoints: nonnegativeNumberSchema,
    availableBasePoints: nonnegativeNumberSchema,
    correctnessPoints: nonnegativeNumberSchema,
    availableCorrectnessPoints: nonnegativeNumberSchema,
    bonusPoints: nonnegativeNumberSchema,
    availableBonusPoints: nonnegativeNumberSchema,
    totalPoints: nonnegativeNumberSchema,
    availableTotalPoints: nonnegativeNumberSchema,
  })
  .strict()

export const assessmentReportSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    subject: z
      .object({
        email: normalizedEmailSchema,
        source: z.literal('COURSE_INVITATION'),
      })
      .strict(),
    course: assessmentReportCourseSchema,
    results: assessmentReportResultsSchema,
    comparison: assessmentReportComparisonSchema,
  })
  .strict()
  .superRefine(validateAssessmentReportSnapshot)

export const assessmentReportSnapshotV2Schema = z
  .object({
    version: z.literal(2),
    subject: z
      .object({
        email: normalizedEmailSchema,
        givenName: nullableIdentityValueSchema,
        surname: nullableIdentityValueSchema,
        matriculationNumber: nullableIdentityValueSchema,
        source: z.literal('SWITCH_EDUID'),
      })
      .strict(),
    course: assessmentReportCourseSchema,
    results: assessmentReportResultsSchema,
    comparison: assessmentReportComparisonSchema,
  })
  .strict()
  .superRefine(validateAssessmentReportSnapshot)

export type IssuedAssessmentReport = {
  token: string
  status: DB.CredentialStatus
  issuedAt: Date
  snapshot: AssessmentReportSnapshot
}

function assessmentReportError(
  code:
    | 'ASSESSMENT_REPORT_NOT_ELIGIBLE'
    | 'ASSESSMENT_REPORT_IDENTITY_UNVERIFIED'
    | 'ASSESSMENT_REPORT_REVOKED'
    | 'ASSESSMENT_REPORT_INVALID_DATA'
) {
  return new GraphQLError(code, { extensions: { code } })
}

export function buildAssessmentReportComparison({
  scores,
  studentScore,
  availableTotalPoints,
}: {
  scores: number[]
  studentScore: number
  availableTotalPoints: number
}): AssessmentReportSnapshotV1['comparison'] {
  if (
    scores.length < MINIMUM_COMPARISON_COHORT_SIZE ||
    availableTotalPoints <= 0
  ) {
    return null
  }

  const percentile = Math.round(
    (scores.filter((score) => score <= studentScore).length / scores.length) *
      100
  )
  const binWidth = availableTotalPoints / HISTOGRAM_BASE_BIN_COUNT
  const baseBins = Array.from(
    { length: HISTOGRAM_BASE_BIN_COUNT },
    (_, index): AssessmentReportHistogramBin => ({
      binStart: index * binWidth,
      binEnd:
        index === HISTOGRAM_BASE_BIN_COUNT - 1
          ? availableTotalPoints
          : (index + 1) * binWidth,
      count: 0,
    })
  )

  for (const score of scores) {
    const boundedScore = Math.min(Math.max(score, 0), availableTotalPoints)
    const index = Math.min(
      Math.floor(boundedScore / binWidth),
      HISTOGRAM_BASE_BIN_COUNT - 1
    )
    baseBins[index]!.count += 1
  }

  const histogram: AssessmentReportHistogramBin[] = []
  let pendingStart = baseBins[0]!.binStart
  let pendingEnd = pendingStart
  let pendingCount = 0

  for (const bin of baseBins) {
    pendingEnd = bin.binEnd
    pendingCount += bin.count

    if (pendingCount >= MINIMUM_HISTOGRAM_BIN_SIZE) {
      histogram.push({
        binStart: pendingStart,
        binEnd: pendingEnd,
        count: pendingCount,
      })
      pendingStart = pendingEnd
      pendingCount = 0
    }
  }

  if (pendingEnd > pendingStart) {
    const previous = histogram.at(-1)
    if (previous) {
      previous.binEnd = pendingEnd
      previous.count += pendingCount
    } else {
      histogram.push({
        binStart: pendingStart,
        binEnd: pendingEnd,
        count: pendingCount,
      })
    }
  }

  const comparison = {
    cohortSize: scores.length,
    percentile,
    histogram,
  }
  const parsed = assessmentReportComparisonSchema.safeParse(comparison)
  if (!parsed.success) {
    throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
  }
  return parsed.data
}

export function canonicalizeJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`
  }
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${canonicalizeJson(entryValue)}`
      )
      .join(',')}}`
  }
  throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
}

export function hashAssessmentReportSnapshot(
  snapshot: AssessmentReportSnapshot
) {
  return createHash('sha256').update(canonicalizeJson(snapshot)).digest('hex')
}

export function withoutAssessmentReportComparison(
  snapshot: AssessmentReportSnapshot
): AssessmentReportSnapshot {
  return snapshot.comparison === null
    ? snapshot
    : { ...snapshot, comparison: null }
}

export function assessmentReportClaimsMatch(
  left: AssessmentReportSnapshot,
  right: AssessmentReportSnapshot
) {
  return (
    hashAssessmentReportSnapshot(withoutAssessmentReportComparison(left)) ===
    hashAssessmentReportSnapshot(withoutAssessmentReportComparison(right))
  )
}

export function parseAssessmentReportSnapshot({
  snapshotVersion,
  snapshot,
}: {
  snapshotVersion: number
  snapshot: unknown
}): AssessmentReportSnapshot | null {
  if (snapshotVersion === 1) {
    const parsed = assessmentReportSnapshotV1Schema.safeParse(snapshot)
    return parsed.success ? parsed.data : null
  }
  if (snapshotVersion === 2) {
    const parsed = assessmentReportSnapshotV2Schema.safeParse(snapshot)
    return parsed.success ? parsed.data : null
  }
  return null
}

export async function buildAssessmentReportSnapshotV1({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: PrismaTransactionClient
}): Promise<AssessmentReportSnapshotV1> {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isAssessmentEnabled: true,
      participations: {
        some: {
          participantId,
          participant: { isActive: true },
        },
      },
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      participantInvitations: {
        where: {
          participantId,
          status: DB.InvitationStatus.ACCEPTED,
          acceptedAt: { not: null },
        },
        select: { email: true },
        orderBy: [{ acceptedAt: 'asc' }, { id: 'asc' }],
      },
    },
  })
  if (!course) {
    throw assessmentReportError('ASSESSMENT_REPORT_NOT_ELIGIBLE')
  }

  const subjectEmail = course.participantInvitations
    .map((invitation) => normalizeEmail(invitation.email))
    .find((email): email is string => email !== null)
  if (!subjectEmail) {
    throw assessmentReportError('ASSESSMENT_REPORT_IDENTITY_UNVERIFIED')
  }

  const courseResults = await calculateAssessmentCourseScores(
    { courseId },
    { prisma }
  )
  const studentResults = courseResults?.studentResults.find(
    (result) => result.participantId === participantId
  )
  if (!courseResults || !studentResults) {
    throw assessmentReportError('ASSESSMENT_REPORT_NOT_ELIGIBLE')
  }

  const totalPoints =
    studentResults.basePoints +
    studentResults.correctnessPoints +
    studentResults.bonusPoints
  const availableTotalPoints =
    courseResults.availableBasePoints +
    courseResults.availableCorrectnessPoints +
    courseResults.availableBonusPoints
  const scores = courseResults.studentResults.map(
    (result) =>
      result.basePoints + result.correctnessPoints + result.bonusPoints
  )

  const parsed = assessmentReportSnapshotV1Schema.safeParse({
    version: 1,
    subject: { email: subjectEmail, source: 'COURSE_INVITATION' },
    course: {
      id: course.id,
      name: course.name,
      displayName: course.displayName,
    },
    results: {
      basePoints: studentResults.basePoints,
      availableBasePoints: courseResults.availableBasePoints,
      correctnessPoints: studentResults.correctnessPoints,
      availableCorrectnessPoints: courseResults.availableCorrectnessPoints,
      bonusPoints: studentResults.bonusPoints,
      availableBonusPoints: courseResults.availableBonusPoints,
      totalPoints,
      availableTotalPoints,
    },
    comparison: buildAssessmentReportComparison({
      scores,
      studentScore: totalPoints,
      availableTotalPoints,
    }),
  } satisfies AssessmentReportSnapshotV1)

  if (!parsed.success) {
    throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
  }
  return parsed.data
}

export async function buildAssessmentReportSnapshot({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: PrismaTransactionClient
}): Promise<AssessmentReportSnapshot> {
  const snapshotV1 = await buildAssessmentReportSnapshotV1({
    courseId,
    participantId,
    prisma,
  })
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: { courseId, participantId },
    },
    select: {
      assessmentGivenName: true,
      assessmentSurname: true,
      assessmentMatriculationNumber: true,
    },
  })

  const givenName = normalizeIdentityValue(
    participation?.assessmentGivenName ?? null
  )
  const surname = normalizeIdentityValue(
    participation?.assessmentSurname ?? null
  )
  const matriculationNumber = normalizeIdentityValue(
    participation?.assessmentMatriculationNumber ?? null
  )

  if (givenName === null && surname === null && matriculationNumber === null) {
    return snapshotV1
  }

  // The subject email stays the accepted course-invitation address rather than
  // Participant.email: invitations are only ever auto-accepted against a verified
  // edu-ID linked affiliation address, while Participant.email is freely editable
  // by the participant and therefore carries no edu-ID provenance.
  const parsed = assessmentReportSnapshotV2Schema.safeParse({
    version: 2,
    subject: {
      email: snapshotV1.subject.email,
      givenName,
      surname,
      matriculationNumber,
      source: 'SWITCH_EDUID',
    },
    course: snapshotV1.course,
    results: snapshotV1.results,
    comparison: snapshotV1.comparison,
  })
  if (!parsed.success) {
    throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
  }
  return parsed.data
}

function toIssuedAssessmentReport(
  record: Pick<
    DB.VerifiableCredential,
    | 'token'
    | 'status'
    | 'issuedAt'
    | 'snapshotVersion'
    | 'snapshot'
    | 'snapshotHash'
  >
): IssuedAssessmentReport {
  const snapshot = parseAssessmentReportSnapshot(record)
  if (
    !snapshot ||
    hashAssessmentReportSnapshot(snapshot) !== record.snapshotHash
  ) {
    throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
  }
  return {
    token: record.token,
    status: record.status,
    issuedAt: record.issuedAt,
    snapshot,
  }
}

async function issueAssessmentReportInTransaction({
  courseId,
  participantId,
  prisma,
  auditTx,
  auditOperation,
}: {
  courseId: string
  participantId: string
  prisma: PrismaTransactionClient
  auditTx: AuditTransactionClient
  auditOperation: AssessmentAuditOperation
}): Promise<IssuedAssessmentReport> {
  const recordKey = {
    participantId,
    courseId,
    type: DB.CredentialType.COURSE_ASSESSMENT_INSIGHTS,
  }
  const [activeRecord, historyRecord] = await Promise.all([
    prisma.verifiableCredential.findFirst({
      where: { ...recordKey, status: DB.CredentialStatus.ACTIVE },
    }),
    prisma.verifiableCredential.findFirst({
      where: recordKey,
      select: { id: true },
    }),
  ])
  const fullSnapshot = await buildAssessmentReportSnapshot({
    courseId,
    participantId,
    prisma,
  })
  const fullSnapshotHash = hashAssessmentReportSnapshot(fullSnapshot)
  const privateReplacementSnapshot =
    withoutAssessmentReportComparison(fullSnapshot)
  const privateReplacementHash = hashAssessmentReportSnapshot(
    privateReplacementSnapshot
  )

  if (activeRecord) {
    const activeSnapshot = parseAssessmentReportSnapshot(activeRecord)
    if (
      !activeSnapshot ||
      hashAssessmentReportSnapshot(activeSnapshot) !== activeRecord.snapshotHash
    ) {
      throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
    }
    if (
      activeRecord.snapshotHash === fullSnapshotHash ||
      assessmentReportClaimsMatch(activeSnapshot, fullSnapshot)
    ) {
      return toIssuedAssessmentReport(activeRecord)
    }
  }

  // Comparisons are released only once. Replacements omit them so two
  // downloadable reports cannot be differenced after a cohort change.
  const snapshot = historyRecord ? privateReplacementSnapshot : fullSnapshot
  const snapshotHash = historyRecord ? privateReplacementHash : fullSnapshotHash

  const revokedRecords = await prisma.verifiableCredential.findMany({
    where: {
      ...recordKey,
      status: DB.CredentialStatus.REVOKED,
    },
    select: {
      snapshot: true,
      snapshotVersion: true,
      snapshotHash: true,
    },
  })
  const matchesRevokedClaims = revokedRecords.some((record) => {
    const revokedSnapshot = parseAssessmentReportSnapshot(record)
    if (
      revokedSnapshot === null ||
      hashAssessmentReportSnapshot(revokedSnapshot) !== record.snapshotHash
    ) {
      return false
    }

    return (
      record.snapshotHash === fullSnapshotHash ||
      record.snapshotHash === privateReplacementHash ||
      assessmentReportClaimsMatch(revokedSnapshot, fullSnapshot)
    )
  })
  if (matchesRevokedClaims) {
    throw assessmentReportError('ASSESSMENT_REPORT_REVOKED')
  }

  if (activeRecord) {
    const superseded = await prisma.verifiableCredential.updateMany({
      where: { id: activeRecord.id, status: DB.CredentialStatus.ACTIVE },
      data: {
        status: DB.CredentialStatus.SUPERSEDED,
        supersededAt: new Date(),
      },
    })
    if (superseded.count !== 1) {
      throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
    }
  }

  const created = await prisma.verifiableCredential.create({
    data: {
      token: randomBytes(32).toString('hex'),
      type: recordKey.type,
      participantId,
      courseId,
      subjectEmail: snapshot.subject.email,
      snapshot,
      snapshotVersion: snapshot.version,
      snapshotHash,
    },
  })
  const reportDrafts = [
    ...(activeRecord === null
      ? []
      : [
          {
            eventType: 'ASSESSMENT_REPORT_SUPERSEDED' as const,
            producerOperationId: `${auditOperation.correlationId}:report:${activeRecord.id}:superseded`,
            scope: { participantId },
            payload: {
              reportId: created.id,
              version: created.snapshotVersion,
              snapshotHash: created.snapshotHash,
              previousReportId: activeRecord.id,
              reasonCode: 'PARTICIPANT_REISSUED_REPORT',
            },
          },
        ]),
    {
      eventType: 'ASSESSMENT_REPORT_ISSUED' as const,
      producerOperationId: `${auditOperation.correlationId}:report:${created.id}:issued`,
      scope: { participantId },
      payload: {
        reportId: created.id,
        version: created.snapshotVersion,
        snapshotHash: created.snapshotHash,
        ...(activeRecord === null ? {} : { previousReportId: activeRecord.id }),
      },
    },
  ]
  await emitCoveredCourseAssessmentAuditEvents({
    tx: prisma,
    auditTx,
    courseId,
    operation: auditOperation,
    drafts: reportDrafts,
  })
  return toIssuedAssessmentReport(created)
}

function isPrismaError(error: unknown, code: 'P2002' | 'P2034') {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

async function getEquivalentActiveRecord({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: DB.PrismaClient
}) {
  return await prisma.$transaction(
    async (tx) => {
      const activeRecord = await tx.verifiableCredential.findFirst({
        where: {
          participantId,
          courseId,
          type: DB.CredentialType.COURSE_ASSESSMENT_INSIGHTS,
          status: DB.CredentialStatus.ACTIVE,
        },
      })
      if (!activeRecord) return null

      const activeSnapshot = parseAssessmentReportSnapshot(activeRecord)
      if (!activeSnapshot) return null
      const currentSnapshot = await buildAssessmentReportSnapshot({
        courseId,
        participantId,
        prisma: tx,
      })
      return assessmentReportClaimsMatch(activeSnapshot, currentSnapshot)
        ? toIssuedAssessmentReport(activeRecord)
        : null
    },
    {
      isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
      maxWait: TRANSACTION_MAX_WAIT_MS,
      timeout: TRANSACTION_TIMEOUT_MS,
    }
  )
}

async function getEquivalentActiveRecordWithRetry(params: {
  courseId: string
  participantId: string
  prisma: DB.PrismaClient
}) {
  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt++) {
    try {
      return await getEquivalentActiveRecord(params)
    } catch (error) {
      if (
        isPrismaError(error, 'P2034') &&
        attempt < TRANSACTION_RETRY_LIMIT - 1
      ) {
        continue
      }
      throw error
    }
  }
  return null
}

export async function issueAssessmentReport(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
): Promise<IssuedAssessmentReport> {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw assessmentReportError('ASSESSMENT_REPORT_NOT_ELIGIBLE')
  }
  const auditOperation = assessmentAuditParticipantOperation({
    participantId: ctx.user.sub,
  })

  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt++) {
    try {
      return await runInAuditTransaction(
        ctx.prisma,
        async (tx, auditTx) =>
          await issueAssessmentReportInTransaction({
            courseId,
            participantId: ctx.user.sub,
            prisma: tx,
            auditTx,
            auditOperation,
          }),
        {
          isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        }
      )
    } catch (error) {
      if (
        isPrismaError(error, 'P2034') &&
        attempt < TRANSACTION_RETRY_LIMIT - 1
      ) {
        continue
      }
      if (isPrismaError(error, 'P2002')) {
        const winner = await getEquivalentActiveRecordWithRetry({
          courseId,
          participantId: ctx.user.sub,
          prisma: ctx.prisma,
        })
        if (winner) return winner
        throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
      }
      throw error
    }
  }

  throw assessmentReportError('ASSESSMENT_REPORT_INVALID_DATA')
}
