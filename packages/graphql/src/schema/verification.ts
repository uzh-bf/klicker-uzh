import * as DB from '@klicker-uzh/prisma/client'
import type {
  AssessmentReportPublicSnapshot,
  AssessmentReportSnapshot,
  AssessmentReportSnapshotV1,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import {
  type IssuedAssessmentReport,
  issueAssessmentReport,
} from '../services/assessmentReports.js'
import {
  type CourseAssessmentReportRecord,
  type CourseAssessmentReportRecordPage,
  getCourseAssessmentReportRecordCount,
  getCourseAssessmentReportRecords,
  getPublicAssessmentReport,
  type PublicAssessmentReportVerification,
  revokeAssessmentReport,
} from '../services/verification.js'

const asParticipant = {
  authenticated: true,
  role: DB.UserRole.PARTICIPANT,
}
const asUser = { authenticated: true, role: DB.UserRole.USER }
const asUserFullAccess = { ...asUser, scope: DB.UserLoginScope.FULL_ACCESS }

export const AssessmentReportCredentialStatus = builder.enumType(
  'AssessmentReportCredentialStatus',
  { values: Object.values(DB.CredentialStatus) }
)

export const AssessmentReportVerificationStatus = builder.enumType(
  'AssessmentReportVerificationStatus',
  {
    values: ['ACTIVE', 'REVOKED', 'SUPERSEDED', 'DATA_UNAVAILABLE'] as const,
  }
)

export const AssessmentReportIdentitySource = builder.enumType(
  'AssessmentReportIdentitySource',
  {
    values: {
      COURSE_INVITATION: { value: 'COURSE_INVITATION' },
      SWITCH_EDUID: { value: 'SWITCH_EDUID' },
    } as const,
  }
)

const AssessmentReportSubjectRef = builder.objectRef<
  AssessmentReportSnapshot['subject']
>('AssessmentReportSubject')
builder.objectType(AssessmentReportSubjectRef, {
  fields: (t) => ({
    email: t.exposeString('email'),
    givenName: t.field({
      type: 'String',
      nullable: true,
      resolve: (subject) => ('givenName' in subject ? subject.givenName : null),
    }),
    surname: t.field({
      type: 'String',
      nullable: true,
      resolve: (subject) => ('surname' in subject ? subject.surname : null),
    }),
    matriculationNumber: t.field({
      type: 'String',
      nullable: true,
      resolve: (subject) =>
        'matriculationNumber' in subject ? subject.matriculationNumber : null,
    }),
    source: t.expose('source', { type: AssessmentReportIdentitySource }),
  }),
})

const PublicAssessmentReportSubjectRef = builder.objectRef<
  AssessmentReportPublicSnapshot['subject']
>('PublicAssessmentReportSubject')
builder.objectType(PublicAssessmentReportSubjectRef, {
  fields: (t) => ({
    name: t.exposeString('name', { nullable: true }),
    source: t.expose('source', { type: AssessmentReportIdentitySource }),
  }),
})

const AssessmentReportCourseRef = builder.objectRef<
  AssessmentReportSnapshotV1['course']
>('AssessmentReportCourse')
builder.objectType(AssessmentReportCourseRef, {
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
  }),
})

const PublicAssessmentReportCourseRef = builder.objectRef<
  Pick<AssessmentReportSnapshotV1['course'], 'name' | 'displayName'>
>('PublicAssessmentReportCourse')
builder.objectType(PublicAssessmentReportCourseRef, {
  fields: (t) => ({
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
  }),
})

const AssessmentReportResultsRef = builder.objectRef<
  AssessmentReportSnapshotV1['results']
>('AssessmentReportResults')
builder.objectType(AssessmentReportResultsRef, {
  fields: (t) => ({
    basePoints: t.exposeFloat('basePoints'),
    availableBasePoints: t.exposeFloat('availableBasePoints'),
    correctnessPoints: t.exposeFloat('correctnessPoints'),
    availableCorrectnessPoints: t.exposeFloat('availableCorrectnessPoints'),
    bonusPoints: t.exposeFloat('bonusPoints'),
    availableBonusPoints: t.exposeFloat('availableBonusPoints'),
    totalPoints: t.exposeFloat('totalPoints'),
    availableTotalPoints: t.exposeFloat('availableTotalPoints'),
  }),
})

type AssessmentReportComparison = NonNullable<
  AssessmentReportSnapshotV1['comparison']
>
const AssessmentReportHistogramBinRef = builder.objectRef<
  AssessmentReportComparison['histogram'][number]
>('AssessmentReportHistogramBin')
builder.objectType(AssessmentReportHistogramBinRef, {
  fields: (t) => ({
    binStart: t.exposeFloat('binStart'),
    binEnd: t.exposeFloat('binEnd'),
    count: t.exposeInt('count'),
  }),
})

const AssessmentReportComparisonRef =
  builder.objectRef<AssessmentReportComparison>('AssessmentReportComparison')
builder.objectType(AssessmentReportComparisonRef, {
  fields: (t) => ({
    cohortSize: t.exposeInt('cohortSize'),
    percentile: t.exposeInt('percentile'),
    histogram: t.expose('histogram', {
      type: [AssessmentReportHistogramBinRef],
    }),
  }),
})

const AssessmentReportSnapshotRef = builder.objectRef<AssessmentReportSnapshot>(
  'AssessmentReportSnapshot'
)
builder.objectType(AssessmentReportSnapshotRef, {
  fields: (t) => ({
    version: t.exposeInt('version'),
    subject: t.expose('subject', { type: AssessmentReportSubjectRef }),
    course: t.expose('course', { type: AssessmentReportCourseRef }),
    results: t.expose('results', { type: AssessmentReportResultsRef }),
    comparison: t.expose('comparison', {
      type: AssessmentReportComparisonRef,
      nullable: true,
    }),
  }),
})

const PublicAssessmentReportSnapshotRef =
  builder.objectRef<AssessmentReportPublicSnapshot>(
    'PublicAssessmentReportSnapshot'
  )
builder.objectType(PublicAssessmentReportSnapshotRef, {
  fields: (t) => ({
    version: t.exposeInt('version'),
    subject: t.expose('subject', { type: PublicAssessmentReportSubjectRef }),
    course: t.field({
      type: PublicAssessmentReportCourseRef,
      resolve: (snapshot) => snapshot.course,
    }),
    results: t.expose('results', { type: AssessmentReportResultsRef }),
    comparison: t.expose('comparison', {
      type: AssessmentReportComparisonRef,
      nullable: true,
    }),
  }),
})

const IssuedAssessmentReportRef = builder.objectRef<IssuedAssessmentReport>(
  'IssuedAssessmentReport'
)
builder.objectType(IssuedAssessmentReportRef, {
  fields: (t) => ({
    token: t.exposeString('token'),
    status: t.expose('status', { type: AssessmentReportCredentialStatus }),
    issuedAt: t.expose('issuedAt', { type: 'Date' }),
    snapshot: t.expose('snapshot', { type: AssessmentReportSnapshotRef }),
  }),
})

const PublicAssessmentReportVerificationRef =
  builder.objectRef<PublicAssessmentReportVerification>(
    'PublicAssessmentReportVerification'
  )
builder.objectType(PublicAssessmentReportVerificationRef, {
  fields: (t) => ({
    status: t.expose('status', { type: AssessmentReportVerificationStatus }),
    issuedAt: t.expose('issuedAt', { type: 'Date' }),
    snapshot: t.expose('snapshot', {
      type: PublicAssessmentReportSnapshotRef,
      nullable: true,
    }),
  }),
})

const CourseAssessmentReportRecordRef =
  builder.objectRef<CourseAssessmentReportRecord>(
    'CourseAssessmentReportRecord'
  )
builder.objectType(CourseAssessmentReportRecordRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    subjectEmail: t.exposeString('subjectEmail'),
    status: t.expose('status', { type: AssessmentReportCredentialStatus }),
    issuedAt: t.expose('issuedAt', { type: 'Date' }),
    revokedAt: t.expose('revokedAt', { type: 'Date', nullable: true }),
    supersededAt: t.expose('supersededAt', {
      type: 'Date',
      nullable: true,
    }),
    verificationToken: t.string({ resolve: (record) => record.token }),
  }),
})

const CourseAssessmentReportRecordPageRef =
  builder.objectRef<CourseAssessmentReportRecordPage>(
    'CourseAssessmentReportRecordPage'
  )
builder.objectType(CourseAssessmentReportRecordPageRef, {
  fields: (t) => ({
    totalCount: t.exposeInt('totalCount'),
    records: t.expose('records', { type: [CourseAssessmentReportRecordRef] }),
  }),
})

builder.queryFields((t) => ({
  assessmentReportVerification: t.field({
    type: PublicAssessmentReportVerificationRef,
    nullable: true,
    args: { token: t.arg.string({ required: true }) },
    resolve: (_, args, ctx) => getPublicAssessmentReport(args, ctx),
  }),
  courseAssessmentReportRecords: t.withAuth(asUserFullAccess).field({
    type: CourseAssessmentReportRecordPageRef,
    args: {
      courseId: t.arg.string({ required: true }),
      statusFilter: t.arg({
        type: [AssessmentReportCredentialStatus],
        required: false,
      }),
      searchString: t.arg.string({ required: false }),
      numEntries: t.arg.int({ required: false }),
      offset: t.arg.int({ required: false }),
    },
    resolve: (_, args, ctx) => getCourseAssessmentReportRecords(args, ctx),
  }),
  courseAssessmentReportRecordCount: t.withAuth(asUserFullAccess).int({
    args: { courseId: t.arg.string({ required: true }) },
    resolve: (_, args, ctx) => getCourseAssessmentReportRecordCount(args, ctx),
  }),
}))

builder.mutationFields((t) => ({
  issueAssessmentReport: t.withAuth(asParticipant).field({
    type: IssuedAssessmentReportRef,
    args: { courseId: t.arg.string({ required: true }) },
    resolve: (_, args, ctx) => issueAssessmentReport(args, ctx),
  }),
  revokeAssessmentReport: t.withAuth(asUserFullAccess).field({
    type: CourseAssessmentReportRecordRef,
    args: { id: t.arg.string({ required: true }) },
    resolve: (_, args, ctx) => revokeAssessmentReport(args, ctx),
  }),
}))
