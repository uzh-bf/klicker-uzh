import { allowCoursePurgeInTransaction, prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  CredentialStatus,
  InvitationStatus,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  hashAssessmentReportSnapshot,
  issueAssessmentReport,
} from '../src/services/assessmentReports.js'
import {
  getAssessmentResultsCourse,
  getStudentAssessmentResults,
} from '../src/services/courses.js'
import {
  getCourseAssessmentReportRecordCount,
  getCourseAssessmentReportRecords,
  getPublicAssessmentReport,
  revokeAssessmentReport,
} from '../src/services/verification.js'

const TEST_PREFIX = `assessment-report-test-${Date.now()}`
const fixtureIds: {
  courseIds: string[]
  participantIds: string[]
  userIds: string[]
} = { courseIds: [], participantIds: [], userIds: [] }

function participantContext(
  participantId: string,
  scope: UserLoginScope = UserLoginScope.READ_ONLY
): ContextWithUser {
  return {
    prisma,
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function lecturerContext(
  userId: string,
  scope: UserLoginScope = UserLoginScope.ACCOUNT_OWNER
): ContextWithUser {
  return {
    prisma,
    user: {
      sub: userId,
      role: UserRole.USER,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function publicContext(): Context {
  return { prisma } as unknown as Context
}

async function createFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const invitationEmail = `${TEST_PREFIX}-invited-${suffix}@example.net`
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${TEST_PREFIX}-lecturer-${suffix}`,
      email: `${TEST_PREFIX}-lecturer-${suffix}@example.org`,
      name: 'Assessment Report Lecturer',
    },
  })
  fixtureIds.userIds.push(lecturer.id)

  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-course-${suffix}`,
      displayName: 'Assessment Report Course',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      groupDeadlineDate: new Date(),
      isAssessmentEnabled: true,
      authType: CourseAuthType.SSO,
      ownerId: lecturer.id,
    },
  })
  fixtureIds.courseIds.push(course.id)
  await recomputeDerivedPermissions({ courseId: course.id }, prisma)

  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-participant-${suffix}`,
      email: `${TEST_PREFIX}-untrusted-${suffix}@example.net`,
      password: 'not-used',
      isActive: true,
      invitations: {
        create: {
          courseId: course.id,
          email: invitationEmail,
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      },
      participations: {
        create: { courseId: course.id, isActive: true },
      },
    },
  })
  fixtureIds.participantIds.push(participant.id)

  return {
    lecturer,
    course,
    participant,
    invitationEmail,
    participantCtx: participantContext(participant.id),
    lecturerCtx: lecturerContext(lecturer.id),
  }
}

async function cleanupFixtures() {
  const courseIds = fixtureIds.courseIds.splice(0)
  await prisma.$transaction(async (tx) => {
    await tx.course.updateMany({
      where: { id: { in: courseIds } },
      data: { isDeleted: true },
    })
    await allowCoursePurgeInTransaction(tx)
    await tx.course.deleteMany({
      where: { id: { in: courseIds }, isDeleted: true },
    })
  })
  await prisma.participant.deleteMany({
    where: { id: { in: fixtureIds.participantIds.splice(0) } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: fixtureIds.userIds.splice(0) } },
  })
}

describe('assessment report credential services', () => {
  afterEach(cleanupFixtures)
  afterAll(async () => prisma.$disconnect())

  it('allows invitation-backed participants to access results without an Edu-ID scope', async () => {
    const fixture = await createFixture()

    await expect(
      getStudentAssessmentResults(
        {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
        participantContext(fixture.participant.id, UserLoginScope.ACCOUNT_OWNER)
      )
    ).resolves.toEqual({
      liveQuizzes: [],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })
  })

  it('keeps participant assessment-result access invitation-backed and self-scoped', async () => {
    const fixture = await createFixture()

    await expect(
      getStudentAssessmentResults(
        {
          courseId: fixture.course.id,
          participantId: '00000000-0000-0000-0000-000000000000',
        },
        fixture.participantCtx
      )
    ).rejects.toThrow(
      'Participants can only access their own assessment results'
    )

    await prisma.participantInvitation.updateMany({
      where: {
        courseId: fixture.course.id,
        participantId: fixture.participant.id,
      },
      data: {
        status: InvitationStatus.PENDING,
        acceptedAt: null,
        participantId: null,
      },
    })

    await expect(
      getStudentAssessmentResults(
        {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
        fixture.participantCtx
      )
    ).rejects.toThrow(
      'Assessment participation with an accepted invitation not found'
    )
  })

  it('allows leaderboard-inactive participants to access their assessment results', async () => {
    const fixture = await createFixture()
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
      data: { isActive: false },
    })

    await expect(
      getStudentAssessmentResults(
        {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
        fixture.participantCtx
      )
    ).resolves.toEqual({
      liveQuizzes: [],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })
  })

  it('uses the accepted non-UZH course invitation without an Edu-ID scope', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      participantContext(fixture.participant.id, UserLoginScope.READ_ONLY)
    )

    expect(issued.token).toMatch(/^[a-f0-9]{64}$/)
    expect(issued.snapshot.subject).toEqual({
      email: fixture.invitationEmail,
      source: 'COURSE_INVITATION',
    })
    expect(issued.snapshot.subject.email).not.toBe(fixture.participant.email)

    const publicRecord = await getPublicAssessmentReport(
      { token: issued.token },
      publicContext()
    )
    expect(publicRecord?.snapshot?.subject).toEqual({
      name: null,
      source: 'COURSE_INVITATION',
    })
  })

  it('stores assessment edu-ID identity in the private report and exposes only the name publicly', async () => {
    const fixture = await createFixture()
    // A self-chosen profile email must never surface on the credential, so make it
    // differ from the invitation address the report is expected to carry.
    const profileEmail = `${TEST_PREFIX}-profile-${fixture.participant.id}@example.net`
    await prisma.participant.update({
      where: { id: fixture.participant.id },
      data: { email: profileEmail },
    })
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
      data: {
        assessmentGivenName: 'Ada',
        assessmentSurname: 'Lovelace',
        assessmentMatriculationNumber: '00-123-456',
      },
    })

    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    expect(issued.snapshot).toMatchObject({
      version: 2,
      subject: {
        email: fixture.invitationEmail,
        givenName: 'Ada',
        surname: 'Lovelace',
        matriculationNumber: '00-123-456',
        source: 'SWITCH_EDUID',
      },
    })
    expect(issued.snapshot.subject.email).not.toBe(profileEmail)

    const publicRecord = await getPublicAssessmentReport(
      { token: issued.token },
      publicContext()
    )
    expect(publicRecord?.snapshot?.subject).toEqual({
      name: 'Ada Lovelace',
      source: 'SWITCH_EDUID',
    })
    expect(publicRecord?.snapshot?.subject).not.toHaveProperty('email')
    expect(publicRecord?.snapshot?.subject).not.toHaveProperty(
      'matriculationNumber'
    )
  })

  it('uses the earliest accepted valid invitation deterministically', async () => {
    const fixture = await createFixture()
    const earlierInvitationEmail = `EARLIER-${fixture.invitationEmail.toUpperCase()} `
    await prisma.participantInvitation.create({
      data: {
        courseId: fixture.course.id,
        participantId: fixture.participant.id,
        email: earlierInvitationEmail,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    })

    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    expect(issued.snapshot.subject).toEqual({
      email: earlierInvitationEmail.trim().toLowerCase(),
      source: 'COURSE_INVITATION',
    })
  })

  it('rejects a participation when the accepted invitation is linked elsewhere', async () => {
    const fixture = await createFixture()
    const unrelatedParticipant = await prisma.participant.create({
      data: {
        username: `${TEST_PREFIX}-unrelated-${Date.now()}`,
        password: 'not-used',
        isActive: true,
      },
    })
    fixtureIds.participantIds.push(unrelatedParticipant.id)
    await prisma.participantInvitation.updateMany({
      where: {
        courseId: fixture.course.id,
        participantId: fixture.participant.id,
      },
      data: { participantId: unrelatedParticipant.id },
    })
    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_IDENTITY_UNVERIFIED' },
    })
  })

  it('passes leaderboard-inactive participants at the participation gate but blocks pending invitations', async () => {
    const fixture = await createFixture()
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
      data: { isActive: false },
    })
    await prisma.participantInvitation.updateMany({
      where: {
        courseId: fixture.course.id,
        participantId: fixture.participant.id,
      },
      data: {
        status: InvitationStatus.PENDING,
        acceptedAt: null,
        participantId: null,
      },
    })
    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_IDENTITY_UNVERIFIED' },
    })
  })

  it('issues a report to leaderboard-inactive participants with an accepted invitation', async () => {
    const fixture = await createFixture()
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
      data: { isActive: false },
    })

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).resolves.toMatchObject({
      status: CredentialStatus.ACTIVE,
      snapshot: {
        subject: {
          email: fixture.invitationEmail,
          source: 'COURSE_INVITATION',
        },
      },
    })
  })

  it('rejects issuance for an inactive participant account', async () => {
    const fixture = await createFixture()
    await prisma.participant.update({
      where: { id: fixture.participant.id },
      data: { isActive: false },
    })

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_NOT_ELIGIBLE' },
    })
  })

  it('rejects issuance for a non-assessment course', async () => {
    const fixture = await createFixture()
    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { isAssessmentEnabled: false },
    })

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_NOT_ELIGIBLE' },
    })
  })

  it('returns one token for concurrent insertion and sequential reissue', async () => {
    const fixture = await createFixture()
    const concurrent = await Promise.all([
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      ),
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      ),
    ])
    const first = concurrent[0]!
    const second = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )

    expect(second.token).toBe(first.token)
    expect(concurrent.map((record) => record.token)).toEqual(
      Array(2).fill(first.token)
    )
    expect(
      await prisma.verifiableCredential.count({
        where: {
          participantId: fixture.participant.id,
          courseId: fixture.course.id,
          status: CredentialStatus.ACTIVE,
        },
      })
    ).toBe(1)
  })

  it('does not add a provider-specific scope gate to issuance', async () => {
    const fixture = await createFixture()
    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        participantContext(fixture.participant.id, UserLoginScope.READ_ONLY)
      )
    ).resolves.toMatchObject({
      status: CredentialStatus.ACTIVE,
    })
  })

  it('allows a non-Edu-ID participant through GraphQL authorization', async () => {
    const fixture = await createFixture()
    const resolver = schema.getMutationType()?.getFields()
      .issueAssessmentReport?.resolve
    expect(resolver).toBeDefined()

    const result = await resolver!(
      {},
      { courseId: fixture.course.id },
      participantContext(fixture.participant.id, UserLoginScope.READ_ONLY),
      {} as never
    )

    expect(result).toMatchObject({
      status: CredentialStatus.ACTIVE,
      snapshot: {
        subject: {
          email: fixture.invitationEmail,
          source: 'COURSE_INVITATION',
        },
      },
    })
  })

  it('keeps issuance restricted to participant principals', async () => {
    const fixture = await createFixture()

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.lecturerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_NOT_ELIGIBLE' },
    })
  })

  it('supersedes an active record when authoritative claims change', async () => {
    const fixture = await createFixture()
    const first = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { displayName: 'Renamed Assessment Report Course' },
    })
    const second = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )

    expect(second.token).not.toBe(first.token)
    expect(
      await getPublicAssessmentReport({ token: first.token }, publicContext())
    ).toMatchObject({ status: 'SUPERSEDED', snapshot: null })
    expect(second.snapshot.course.displayName).toBe(
      'Renamed Assessment Report Course'
    )
  })

  it('converges concurrent changed-claim issuance on one active report', async () => {
    const fixture = await createFixture()
    const original = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { displayName: 'Concurrently Renamed Assessment Report Course' },
    })

    const replacements = await Promise.all([
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      ),
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      ),
    ])

    expect(replacements[0]?.token).not.toBe(original.token)
    expect(replacements[1]?.token).toBe(replacements[0]?.token)
    expect(
      await prisma.verifiableCredential.count({
        where: {
          participantId: fixture.participant.id,
          courseId: fixture.course.id,
          status: CredentialStatus.ACTIVE,
        },
      })
    ).toBe(1)
    await expect(
      getPublicAssessmentReport({ token: original.token }, publicContext())
    ).resolves.toMatchObject({ status: CredentialStatus.SUPERSEDED })
  })

  it('redacts revoked claims, blocks equal reissue, and allows changed reissue', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    const revoked = await revokeAssessmentReport(
      { id: record.id },
      fixture.lecturerCtx
    )
    const repeated = await revokeAssessmentReport(
      { id: record.id },
      fixture.lecturerCtx
    )

    expect(revoked.status).toBe(CredentialStatus.REVOKED)
    expect(repeated.status).toBe(CredentialStatus.REVOKED)
    expect(
      await getPublicAssessmentReport({ token: issued.token }, publicContext())
    ).toMatchObject({ status: 'REVOKED', snapshot: null })
    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_REVOKED' },
    })

    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { displayName: 'Changed after revocation' },
    })
    const replacement = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    expect(replacement.token).not.toBe(issued.token)
    expect(replacement.status).toBe(CredentialStatus.ACTIVE)
  })

  it('handles duplicate revocation and issue-versus-revoke races', async () => {
    const duplicateFixture = await createFixture()
    const duplicateIssued = await issueAssessmentReport(
      { courseId: duplicateFixture.course.id },
      duplicateFixture.participantCtx
    )
    const duplicateRecord = await prisma.verifiableCredential.findUniqueOrThrow(
      {
        where: { token: duplicateIssued.token },
      }
    )
    const duplicateResults = await Promise.all([
      revokeAssessmentReport(
        { id: duplicateRecord.id },
        duplicateFixture.lecturerCtx
      ),
      revokeAssessmentReport(
        { id: duplicateRecord.id },
        duplicateFixture.lecturerCtx
      ),
    ])
    expect(duplicateResults).toEqual([
      expect.objectContaining({ status: CredentialStatus.REVOKED }),
      expect.objectContaining({ status: CredentialStatus.REVOKED }),
    ])

    const raceFixture = await createFixture()
    const original = await issueAssessmentReport(
      { courseId: raceFixture.course.id },
      raceFixture.participantCtx
    )
    const originalRecord = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: original.token },
    })
    await prisma.course.update({
      where: { id: raceFixture.course.id },
      data: { displayName: 'Changed During Revocation' },
    })

    const [replacement, oldRecordResult] = await Promise.all([
      issueAssessmentReport(
        { courseId: raceFixture.course.id },
        raceFixture.participantCtx
      ),
      revokeAssessmentReport(
        { id: originalRecord.id },
        raceFixture.lecturerCtx
      ),
    ])
    expect(replacement.token).not.toBe(original.token)
    expect(replacement.status).toBe(CredentialStatus.ACTIVE)
    expect([CredentialStatus.REVOKED, CredentialStatus.SUPERSEDED]).toContain(
      oldRecordResult.status
    )
    await expect(
      prisma.verifiableCredential.count({
        where: {
          participantId: raceFixture.participant.id,
          courseId: raceFixture.course.id,
          status: CredentialStatus.ACTIVE,
        },
      })
    ).resolves.toBe(1)
  })

  it('rejects inconsistent lifecycle states at the database boundary', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )

    await expect(
      prisma.verifiableCredential.update({
        where: { token: issued.token },
        data: { status: CredentialStatus.REVOKED },
      })
    ).rejects.toBeDefined()
    await expect(
      prisma.verifiableCredential.update({
        where: { token: issued.token },
        data: { supersededAt: new Date() },
      })
    ).rejects.toBeDefined()
    await expect(
      prisma.verifiableCredential.findUniqueOrThrow({
        where: { token: issued.token },
        select: { status: true, revokedAt: true, supersededAt: true },
      })
    ).resolves.toEqual({
      status: CredentialStatus.ACTIVE,
      revokedAt: null,
      supersededAt: null,
    })
  })

  it('blocks a revoked report when only comparison claims have drifted', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    await revokeAssessmentReport({ id: record.id }, fixture.lecturerCtx)

    const oldComparisonSnapshot = {
      ...issued.snapshot,
      comparison: {
        cohortSize: 10,
        percentile: 50,
        histogram: [{ binStart: 0, binEnd: 1, count: 10 }],
      },
    }
    await prisma.verifiableCredential.update({
      where: { id: record.id },
      data: {
        snapshot: oldComparisonSnapshot,
        snapshotHash: hashAssessmentReportSnapshot(oldComparisonSnapshot),
      },
    })

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_REVOKED' },
    })
  })

  it('returns a permission-checked, filtered lecturer record page', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const page = await getCourseAssessmentReportRecords(
      {
        courseId: fixture.course.id,
        statusFilter: [CredentialStatus.ACTIVE],
        searchString: issued.snapshot.subject.email.slice(0, 20).toUpperCase(),
        numEntries: 10,
        offset: 0,
      },
      fixture.lecturerCtx
    )

    expect(page.totalCount).toBe(1)
    expect(page.records).toHaveLength(1)
    expect(page.records[0]).toMatchObject({
      token: issued.token,
      subjectEmail: issued.snapshot.subject.email,
      status: CredentialStatus.ACTIVE,
    })
    await expect(
      getCourseAssessmentReportRecordCount(
        { courseId: fixture.course.id },
        fixture.lecturerCtx
      )
    ).resolves.toBe(1)

    await expect(
      getCourseAssessmentReportRecords(
        { courseId: fixture.course.id },
        lecturerContext('00000000-0000-0000-0000-000000000000')
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
  })

  it('paginates and filters lecturer records with a stable total count', async () => {
    const fixture = await createFixture()
    await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { displayName: 'Assessment Report Course v2' },
    })
    await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    await prisma.course.update({
      where: { id: fixture.course.id },
      data: { displayName: 'Assessment Report Course v3' },
    })
    await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )

    const firstPage = await getCourseAssessmentReportRecords(
      { courseId: fixture.course.id, numEntries: 1, offset: 0 },
      fixture.lecturerCtx
    )
    const secondPage = await getCourseAssessmentReportRecords(
      { courseId: fixture.course.id, numEntries: 1, offset: 1 },
      fixture.lecturerCtx
    )
    const activePage = await getCourseAssessmentReportRecords(
      {
        courseId: fixture.course.id,
        statusFilter: [CredentialStatus.ACTIVE],
      },
      fixture.lecturerCtx
    )
    const supersededPage = await getCourseAssessmentReportRecords(
      {
        courseId: fixture.course.id,
        statusFilter: [CredentialStatus.SUPERSEDED],
      },
      fixture.lecturerCtx
    )

    expect(firstPage).toMatchObject({ totalCount: 3 })
    expect(firstPage.records).toHaveLength(1)
    expect(secondPage.records).toHaveLength(1)
    expect(secondPage.records[0]?.id).not.toBe(firstPage.records[0]?.id)
    expect(activePage).toMatchObject({ totalCount: 1 })
    expect(activePage.records[0]?.status).toBe(CredentialStatus.ACTIVE)
    expect(supersededPage).toMatchObject({ totalCount: 2 })
    expect(supersededPage.records).toHaveLength(2)
    await expect(
      getCourseAssessmentReportRecordCount(
        { courseId: fixture.course.id },
        fixture.lecturerCtx
      )
    ).resolves.toBe(3)
  })

  it('derives data-unavailable without exposing malformed active claims', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    await prisma.verifiableCredential.update({
      where: { token: issued.token },
      data: { snapshotVersion: 99 },
    })

    const publicRecord = await getPublicAssessmentReport(
      { token: issued.token },
      publicContext()
    )
    expect(publicRecord).toMatchObject({
      status: 'DATA_UNAVAILABLE',
      snapshot: null,
    })
    expect(publicRecord).not.toHaveProperty('token')
    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ASSESSMENT_REPORT_INVALID_DATA' },
    })
  })

  it('does not trust malformed revoked rows as terminal claim matches', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    await revokeAssessmentReport({ id: record.id }, fixture.lecturerCtx)
    await prisma.verifiableCredential.update({
      where: { id: record.id },
      data: { snapshotVersion: 99 },
    })

    await expect(
      issueAssessmentReport(
        { courseId: fixture.course.id },
        fixture.participantCtx
      )
    ).resolves.toMatchObject({ status: CredentialStatus.ACTIVE })
  })

  it('requires lecturer ADMIN permission for record access and revocation', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    for (const permissionLevel of [
      PermissionLevel.READ,
      PermissionLevel.WRITE,
    ]) {
      await prisma.derivedPermission.update({
        where: {
          courseId_userId: {
            courseId: fixture.course.id,
            userId: fixture.lecturer.id,
          },
        },
        data: { permissionLevel },
      })

      await expect(
        getCourseAssessmentReportRecords(
          { courseId: fixture.course.id },
          fixture.lecturerCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
      await expect(
        getCourseAssessmentReportRecordCount(
          { courseId: fixture.course.id },
          fixture.lecturerCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
      // Revocation normalizes lack of course-admin access to the same
      // NOT_FOUND outcome as a non-existent id, so it cannot be used as an
      // existence oracle for credentials on courses the caller can't admin.
      await expect(
        revokeAssessmentReport({ id: record.id }, fixture.lecturerCtx)
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
    }
  })

  it('requires full account access for lecturer record access, not only course admin', async () => {
    const fixture = await createFixture()
    await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )

    // A course admin on a restricted-scope login (e.g. delegated or
    // session-exec access) must not be able to enumerate subject emails and
    // credential history, even though the course permission itself is ADMIN.
    for (const scope of [
      UserLoginScope.READ_ONLY,
      UserLoginScope.SESSION_EXEC,
    ]) {
      const restrictedCtx = lecturerContext(fixture.lecturer.id, scope)
      await expect(
        getCourseAssessmentReportRecords(
          { courseId: fixture.course.id },
          restrictedCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
      await expect(
        getCourseAssessmentReportRecordCount(
          { courseId: fixture.course.id },
          restrictedCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    }

    for (const scope of [
      UserLoginScope.ACCOUNT_OWNER,
      UserLoginScope.FULL_ACCESS,
    ]) {
      const allowedCtx = lecturerContext(fixture.lecturer.id, scope)
      await expect(
        getCourseAssessmentReportRecordCount(
          { courseId: fixture.course.id },
          allowedCtx
        )
      ).resolves.toBe(1)
    }
  })

  it('reports revocation of an existing but unauthorized record the same as a non-existent one', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    await prisma.derivedPermission.update({
      where: {
        courseId_userId: {
          courseId: fixture.course.id,
          userId: fixture.lecturer.id,
        },
      },
      data: { permissionLevel: PermissionLevel.WRITE },
    })

    const [existingResult, missingResult] = await Promise.allSettled([
      revokeAssessmentReport({ id: record.id }, fixture.lecturerCtx),
      revokeAssessmentReport(
        { id: '00000000-0000-0000-0000-000000000000' },
        fixture.lecturerCtx
      ),
    ])

    expect(existingResult.status).toBe('rejected')
    expect(missingResult.status).toBe('rejected')
    const existingError =
      existingResult.status === 'rejected' ? existingResult.reason : null
    const missingError =
      missingResult.status === 'rejected' ? missingResult.reason : null
    expect(existingError).toMatchObject({
      message: 'ASSESSMENT_REPORT_NOT_FOUND',
      extensions: { code: 'NOT_FOUND' },
    })
    expect(missingError).toMatchObject({
      message: 'ASSESSMENT_REPORT_NOT_FOUND',
      extensions: { code: 'NOT_FOUND' },
    })
  })

  it('allows a full-access delegated lecturer with ADMIN permission to revoke', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    const delegatedContext = lecturerContext(
      fixture.lecturer.id,
      UserLoginScope.FULL_ACCESS
    )

    await expect(
      getCourseAssessmentReportRecords(
        { courseId: fixture.course.id },
        delegatedContext
      )
    ).resolves.toMatchObject({ totalCount: 1 })
    await expect(
      revokeAssessmentReport({ id: record.id }, delegatedContext)
    ).resolves.toMatchObject({ status: CredentialStatus.REVOKED })
  })

  it('requires full account scope before looking up a record to revoke', async () => {
    const fixture = await createFixture()
    const issued = await issueAssessmentReport(
      { courseId: fixture.course.id },
      fixture.participantCtx
    )
    const record = await prisma.verifiableCredential.findUniqueOrThrow({
      where: { token: issued.token },
    })
    const readOnlyContext = lecturerContext(
      fixture.lecturer.id,
      UserLoginScope.READ_ONLY
    )

    await expect(
      revokeAssessmentReport({ id: record.id }, readOnlyContext)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    await expect(
      revokeAssessmentReport(
        { id: '00000000-0000-0000-0000-000000000000' },
        readOnlyContext
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
  })

  it('keeps inactive participants in the existing lecturer results', async () => {
    const fixture = await createFixture()
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: fixture.course.id,
          participantId: fixture.participant.id,
        },
      },
      data: { isActive: false },
    })
    await prisma.participant.update({
      where: { id: fixture.participant.id },
      data: { isActive: false },
    })

    const results = await getAssessmentResultsCourse(
      { courseId: fixture.course.id },
      fixture.lecturerCtx
    )
    expect(results?.studentResults).toContainEqual(
      expect.objectContaining({ participantId: fixture.participant.id })
    )
  })
})
