import { LeaderboardType, type PrismaClient } from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'node:events'
import { randomSixDigitCode } from './responseIdentifiers.js'

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

  const code = randomSixDigitCode()
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

export async function leaveParticipantGroup({
  courseId,
  emitter,
  groupId,
  participantId,
  prisma,
}: {
  courseId: string
  emitter?: EventEmitter
  groupId: string
  participantId: string
  prisma: PrismaClient
}) {
  const participantGroup = await prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      participants: {
        select: {
          id: true,
          leaderboards: {
            where: {
              courseId,
              type: LeaderboardType.COURSE,
            },
            select: { score: true },
          },
        },
      },
    },
  })

  if (!participantGroup) return null

  if (participantGroup.participants.length === 1) {
    const deletedGroup = await prisma.participantGroup.delete({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        code: true,
        participants: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    emitter?.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })

    return deletedGroup
  }

  const aggregate = participantGroup.participants.reduce(
    (acc, participant) => {
      if (participant.id === participantId) return acc

      return {
        sum: acc.sum + (participant.leaderboards[0]?.score ?? 0),
        count: acc.count + 1,
      }
    },
    {
      sum: 0,
      count: 0,
    }
  )
  const averageMemberScore = Math.round(aggregate.sum / aggregate.count)

  return await prisma.participantGroup.update({
    where: { id: groupId },
    data: {
      participants: {
        disconnect: { id: participantId },
      },
      averageMemberScore,
    },
    select: {
      id: true,
      name: true,
      code: true,
      participants: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  })
}

export async function renameParticipantGroup({
  emitter,
  groupId,
  name,
  prisma,
}: {
  emitter?: EventEmitter
  groupId: string
  name: string
  prisma: PrismaClient
}) {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    return null
  }

  const updatedGroup = await prisma.participantGroup.update({
    where: { id: groupId },
    data: { name: trimmedName },
    select: {
      id: true,
      name: true,
    },
  })

  emitter?.emit('invalidate', { typename: 'ParticipantGroup', id: groupId })
  return updatedGroup
}

export async function addMessageToGroup({
  content,
  groupId,
  participantId,
  prisma,
}: {
  content: string
  groupId: string
  participantId: string
  prisma: PrismaClient
}) {
  const group = await prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: {
      participants: {
        select: { id: true },
      },
    },
  })

  if (!group) return null

  if (
    !group.participants.some((participant) => participant.id === participantId)
  ) {
    return null
  }

  return await prisma.groupMessage.create({
    data: {
      content,
      group: {
        connect: { id: groupId },
      },
      participant: {
        connect: { id: participantId },
      },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      participant: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  })
}
