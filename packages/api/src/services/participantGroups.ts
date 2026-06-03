import { LeaderboardType, type PrismaClient } from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'node:events'

export async function createParticipantGroup({
  courseId,
  emitter,
  name,
  participantId,
  prisma,
}: {
  courseId: string
  emitter?: EventEmitter
  name: string
  participantId: string
  prisma: PrismaClient
}) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isGroupCreationEnabled: true },
  })

  const trimmedName = name.trim()
  if (!course || !course.isGroupCreationEnabled || trimmedName === '') {
    return null
  }

  const code = 100000 + Math.floor(Math.random() * 900000)
  const participantGroup = await prisma.participantGroup.create({
    data: {
      name: trimmedName,
      code,
      course: { connect: { id: courseId } },
      participants: { connect: { id: participantId } },
    },
    select: { id: true },
  })

  emitter?.emit('invalidate', {
    typename: 'ParticipantGroup',
    id: participantGroup.id,
  })

  return participantGroup
}

export async function joinParticipantGroup({
  code,
  courseId,
  participantId,
  prisma,
}: {
  code: number
  courseId: string
  participantId: string
  prisma: PrismaClient
}) {
  const participantGroup = await prisma.participantGroup.findUnique({
    where: {
      courseId_code: { courseId, code },
    },
    select: {
      id: true,
      averageMemberScore: true,
      course: {
        select: { maxGroupSize: true },
      },
      participants: {
        select: { id: true },
      },
    },
  })

  if (!participantGroup || !participantGroup.course) {
    return 'FAILURE'
  }

  if (
    participantGroup.participants.length >= participantGroup.course.maxGroupSize
  ) {
    return 'FULL'
  }

  const lbEntry = await prisma.leaderboardEntry.findFirst({
    where: {
      participantId,
      courseId,
      type: LeaderboardType.COURSE,
    },
    select: { score: true },
  })

  const numGroupMembersOld = participantGroup.participants.length
  const aggregateScore =
    participantGroup.averageMemberScore * numGroupMembersOld +
    (lbEntry?.score ?? 0)
  const aggregateCount = numGroupMembersOld + 1
  const averageMemberScore = Math.round(aggregateScore / aggregateCount)

  const updatedParticipantGroup = await prisma.participantGroup.update({
    where: { courseId_code: { courseId, code } },
    data: {
      participants: { connect: { id: participantId } },
      averageMemberScore,
    },
    select: { id: true },
  })

  return updatedParticipantGroup.id
}

export async function joinRandomCourseGroupPool({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
}) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isGroupCreationEnabled: true },
  })

  if (!course || !course.isGroupCreationEnabled) {
    return false
  }

  const poolEntry = await prisma.groupAssignmentPoolEntry.upsert({
    where: {
      courseId_participantId: { courseId, participantId },
    },
    create: {
      course: { connect: { id: courseId } },
      participant: { connect: { id: participantId } },
    },
    update: {},
    select: { id: true },
  })

  return Boolean(poolEntry)
}

export async function leaveRandomCourseGroupPool({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
}) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      isGroupCreationEnabled: true,
      groupAssignmentPoolEntries: {
        where: { participantId },
        select: { id: true },
      },
    },
  })

  if (
    !course ||
    !course.isGroupCreationEnabled ||
    course.groupAssignmentPoolEntries.length === 0
  ) {
    return false
  }

  try {
    await prisma.groupAssignmentPoolEntry.delete({
      where: {
        courseId_participantId: { courseId, participantId },
      },
    })
    return true
  } catch {
    return false
  }
}
