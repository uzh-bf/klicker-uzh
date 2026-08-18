import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { InvitationStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createAssessmentParticipantInvitations,
  deletePendingAssessmentParticipantInvitation,
  getAssessmentParticipantInvitations,
} from '../src/services/participantInvitations.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Assessment participant invitation management', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let lecturerCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    lecturerCtx = initialized.userOneCtx
  })

  afterEach(async () => await testCleanup(prisma))

  async function createAssessmentCourse() {
    const course = await seedCourse({ isAssessmentEnabled: true }, lecturerCtx)
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    return course
  }

  it('lists invitations newest first', async () => {
    const course = await createAssessmentCourse()
    const oldest = await prisma.participantInvitation.create({
      data: {
        courseId: course.id,
        email: 'oldest@example.org',
        invitedAt: new Date('2026-01-01T10:00:00Z'),
      },
    })
    const newest = await prisma.participantInvitation.create({
      data: {
        courseId: course.id,
        email: 'newest@example.org',
        invitedAt: new Date('2026-01-02T10:00:00Z'),
      },
    })

    await expect(
      getAssessmentParticipantInvitations({ courseId: course.id }, lecturerCtx)
    ).resolves.toEqual([
      expect.objectContaining({ id: newest.id }),
      expect.objectContaining({ id: oldest.id }),
    ])
  })

  it('creates valid pending invitations and reports invalid rows', async () => {
    const course = await createAssessmentCourse()

    const result = await createAssessmentParticipantInvitations(
      {
        courseId: course.id,
        invitations: [
          {
            email: ' Pending.Invitation@Example.org ',
            matriculationNumber: ' 12-345-678 ',
          },
          { email: 'not-an-email' },
        ],
      },
      lecturerCtx
    )

    expect(result).toMatchObject({
      totalProcessed: 2,
      created: 1,
      autoAccepted: 0,
      duplicates: 0,
      errors: 1,
      results: [
        {
          email: 'pending.invitation@example.org',
          status: 'created',
        },
        { email: 'not-an-email', status: 'error' },
      ],
    })
    await expect(
      prisma.participantInvitation.findUnique({
        where: {
          email_courseId: {
            courseId: course.id,
            email: 'pending.invitation@example.org',
          },
        },
      })
    ).resolves.toMatchObject({
      matriculationNumber: '12-345-678',
      status: InvitationStatus.PENDING,
    })
  })

  it('rejects malformed emails without aborting valid rows', async () => {
    const course = await createAssessmentCourse()

    const result = await createAssessmentParticipantInvitations(
      {
        courseId: course.id,
        invitations: [
          { email: 'valid.affiliation@uzh.ch' },
          { email: 'missing-domain@' },
          { email: 'two@@example.org' },
          { email: 'contains space@example.org' },
        ],
      },
      lecturerCtx
    )

    expect(result).toMatchObject({
      totalProcessed: 4,
      created: 1,
      autoAccepted: 0,
      duplicates: 0,
      errors: 3,
      results: [
        { email: 'valid.affiliation@uzh.ch', status: 'created' },
        {
          email: 'missing-domain@',
          status: 'error',
          error: 'Invalid email format',
        },
        {
          email: 'two@@example.org',
          status: 'error',
          error: 'Invalid email format',
        },
        {
          email: 'contains space@example.org',
          status: 'error',
          error: 'Invalid email format',
        },
      ],
    })
  })

  it('auto-accepts a verified affiliation account', async () => {
    const course = await createAssessmentCourse()
    const email = 'verified.affiliation@example.org'
    const participant = await prisma.participant.create({
      data: {
        username: `verified-${randomUUID()}`,
        password: 'not-used',
        isSSOAccount: true,
        accounts: {
          create: {
            ssoId: `sso-${randomUUID()}`,
            ssoType: `affiliation-${randomUUID()}`,
            ssoEmail: email,
            type: 'affiliation',
            isVerified: true,
          },
        },
      },
    })

    const result = await createAssessmentParticipantInvitations(
      {
        courseId: course.id,
        invitations: [{ email, matriculationNumber: '99-999-999' }],
      },
      lecturerCtx
    )

    expect(result).toMatchObject({ autoAccepted: 1, errors: 0 })
    await expect(
      prisma.participantInvitation.findUnique({
        where: { email_courseId: { courseId: course.id, email } },
      })
    ).resolves.toMatchObject({
      participantId: participant.id,
      matriculationNumber: '99-999-999',
      status: InvitationStatus.ACCEPTED,
    })
    await expect(
      prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: course.id,
            participantId: participant.id,
          },
        },
      })
    ).resolves.toMatchObject({ isActive: true })
  })

  it('updates the matriculation number on a duplicate invitation', async () => {
    const course = await createAssessmentCourse()
    const invitation = await prisma.participantInvitation.create({
      data: {
        courseId: course.id,
        email: 'duplicate@example.org',
        matriculationNumber: 'old-number',
      },
    })

    const result = await createAssessmentParticipantInvitations(
      {
        courseId: course.id,
        invitations: [
          {
            email: invitation.email,
            matriculationNumber: 'new-number',
          },
        ],
      },
      lecturerCtx
    )

    expect(result).toMatchObject({
      created: 0,
      duplicates: 1,
      results: [{ status: 'duplicate_updated' }],
    })
    await expect(
      prisma.participantInvitation.findUnique({
        where: { id: invitation.id },
      })
    ).resolves.toMatchObject({ matriculationNumber: 'new-number' })
  })

  it('rejects invitation management for non-assessment courses', async () => {
    const course = await seedCourse({}, lecturerCtx)

    await expect(
      getAssessmentParticipantInvitations({ courseId: course.id }, lecturerCtx)
    ).rejects.toMatchObject({ extensions: { code: 'COURSE_NOT_ASSESSMENT' } })
    await expect(
      createAssessmentParticipantInvitations(
        {
          courseId: course.id,
          invitations: [{ email: 'participant@example.org' }],
        },
        lecturerCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'COURSE_NOT_ASSESSMENT' } })
  })

  it('deletes pending invitations from the requested course', async () => {
    const course = await createAssessmentCourse()
    const invitation = await prisma.participantInvitation.create({
      data: { courseId: course.id, email: 'delete-me@example.org' },
    })

    await expect(
      deletePendingAssessmentParticipantInvitation(
        { courseId: course.id, invitationId: invitation.id },
        lecturerCtx
      )
    ).resolves.toMatchObject({ id: invitation.id })
    await expect(
      prisma.participantInvitation.findUnique({
        where: { id: invitation.id },
      })
    ).resolves.toBeNull()
  })

  it('rejects accepted and cross-course invitation deletion', async () => {
    const course = await createAssessmentCourse()
    const otherCourse = await createAssessmentCourse()
    const participant = await prisma.participant.create({
      data: {
        username: `accepted-${randomUUID()}`,
        password: 'not-used',
      },
    })
    const accepted = await prisma.participantInvitation.create({
      data: {
        courseId: course.id,
        email: 'accepted@example.org',
        participantId: participant.id,
        acceptedAt: new Date(),
        status: InvitationStatus.ACCEPTED,
      },
    })
    const otherInvitation = await prisma.participantInvitation.create({
      data: {
        courseId: otherCourse.id,
        email: 'other-course@example.org',
      },
    })

    await expect(
      deletePendingAssessmentParticipantInvitation(
        { courseId: course.id, invitationId: accepted.id },
        lecturerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'INVITATION_NOT_PENDING' },
    })
    await expect(
      deletePendingAssessmentParticipantInvitation(
        { courseId: course.id, invitationId: otherInvitation.id },
        lecturerCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'INVITATION_NOT_FOUND' } })
  })
})
