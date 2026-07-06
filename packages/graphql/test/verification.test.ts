import { prisma as prismaClient } from '@klicker-uzh/prisma'
import { CredentialType, PrismaClient } from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getCourseCredentials,
  getCredentialByToken,
  issueCredential,
  revokeCredential,
} from '../src/services/verification.js'

const TEST_PREFIX = `verification-test-${Date.now()}`

let prisma: PrismaClient
let testParticipantId: string
let testCourseId: string
let testLecturerId: string

async function cleanupTestData() {
  await prisma.verifiableCredential.deleteMany({
    where: {
      course: {
        name: { startsWith: TEST_PREFIX },
      },
    },
  })
  await prisma.course.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  })
  await prisma.participant.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  })
}

describe('Verifiable Credentials Service', () => {
  beforeAll(async () => {
    prisma = prismaClient
    await prisma.$connect()
    await cleanupTestData()

    // 1. Create a lecturer
    const lecturer = await prisma.user.create({
      data: {
        shortname: `${TEST_PREFIX}-lecturer`,
        email: `${TEST_PREFIX}-lecturer@uzh.ch`,
        name: 'Test Lecturer',
      },
    })
    testLecturerId = lecturer.id

    // 2. Create a course owned by the lecturer
    const course = await prisma.course.create({
      data: {
        name: `${TEST_PREFIX}-course`,
        displayName: 'Test Course for Verification',
        description: 'Verifiable course',
        pinCode: 1234,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        groupDeadlineDate: new Date(),
        ownerId: testLecturerId,
      },
    })
    testCourseId = course.id

    // 3. Create a participant
    const participant = await prisma.participant.create({
      data: {
        username: `${TEST_PREFIX}-student`,
        email: `${TEST_PREFIX}-student@uzh.ch`,
        password: 'student-password-hash',
      },
    })
    testParticipantId = participant.id
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  it('correctly issues a new verifiable credential', async () => {
    const mockMetadata = {
      studentEmail: 'student@uzh.ch',
      courseName: 'Test Course',
      basePoints: 24.5,
      availableBasePoints: 30,
      percentile: 88,
    }

    const credential = await issueCredential({
      participantId: testParticipantId,
      courseId: testCourseId,
      type: CredentialType.COURSE_ASSESSMENT_INSIGHTS,
      metadata: mockMetadata,
      prisma,
    })

    expect(credential).toBeDefined()
    expect(credential.id).toBeDefined()
    expect(credential.token).toHaveLength(64) // 32 bytes hex
    expect(credential.type).toBe(CredentialType.COURSE_ASSESSMENT_INSIGHTS)
    expect(credential.isRevoked).toBe(false)
    expect(credential.metadata).toEqual(mockMetadata)
  })

  it('resolves a valid credential by token', async () => {
    const mockMetadata = { score: 10 }
    const issued = await issueCredential({
      participantId: testParticipantId,
      courseId: testCourseId,
      type: CredentialType.COURSE_ASSESSMENT_INSIGHTS,
      metadata: mockMetadata,
      prisma,
    })

    const resolved = await getCredentialByToken({
      token: issued.token,
      prisma,
    })

    expect(resolved).not.toBeNull()
    expect(resolved!.id).toBe(issued.id)
    expect(resolved!.course.id).toBe(testCourseId)
    expect(resolved!.isRevoked).toBe(false)
  })

  it('does not resolve a revoked credential', async () => {
    const issued = await issueCredential({
      participantId: testParticipantId,
      courseId: testCourseId,
      type: CredentialType.COURSE_ASSESSMENT_INSIGHTS,
      metadata: { score: 20 },
      prisma,
    })

    await revokeCredential({ id: issued.id, prisma })

    const resolved = await getCredentialByToken({
      token: issued.token,
      prisma,
    })

    expect(resolved).toBeNull()
  })

  it('retrieves all credentials for a course', async () => {
    const originalCount = (
      await getCourseCredentials({ courseId: testCourseId, prisma })
    ).length

    await issueCredential({
      participantId: testParticipantId,
      courseId: testCourseId,
      type: CredentialType.COURSE_ASSESSMENT_INSIGHTS,
      metadata: { score: 30 },
      prisma,
    })

    const credentials = await getCourseCredentials({
      courseId: testCourseId,
      prisma,
    })

    expect(credentials.length).toBe(originalCount + 1)
  })
})
