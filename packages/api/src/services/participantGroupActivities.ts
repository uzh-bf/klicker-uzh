import {
  ParameterType,
  PublicationStatus,
  type GroupActivity,
  type GroupActivityInstance,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'

type GroupActivityClueSource = {
  displayName: string
  name: string
  type: ParameterType
  unit: string | null
  value: string
}

type StartGroupActivitySource = Pick<
  GroupActivity,
  'id' | 'scheduledEndAt' | 'scheduledStartAt' | 'status'
> & {
  clues: GroupActivityClueSource[]
}

export type StartGroupActivityOutput = {
  groupActivity: {
    activityInstance: Pick<GroupActivityInstance, 'id'>
    id: string
    status: PublicationStatus
  } | null
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items]

  for (let ix = shuffled.length - 1; ix > 0; ix -= 1) {
    const swapIx = Math.floor(Math.random() * (ix + 1))
    const item = shuffled[ix]
    shuffled[ix] = shuffled[swapIx]!
    shuffled[swapIx] = item!
  }

  return shuffled
}

function isActivityAvailable(activity: StartGroupActivitySource) {
  return (
    !dayjs().isBefore(activity.scheduledStartAt) &&
    !dayjs().isAfter(activity.scheduledEndAt)
  )
}

export async function startGroupActivity({
  activityId,
  groupId,
  participantId,
  prisma,
}: {
  activityId: string
  groupId: string
  participantId: string
  prisma: PrismaClient
}): Promise<StartGroupActivityOutput> {
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id: activityId, status: PublicationStatus.PUBLISHED },
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      clues: {
        orderBy: { displayName: 'asc' },
        select: {
          name: true,
          displayName: true,
          type: true,
          unit: true,
          value: true,
        },
      },
    },
  })

  const group = await prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: {
      participants: {
        select: { id: true },
      },
    },
  })

  if (!groupActivity || !group) return { groupActivity: null }

  if (
    !group.participants.some((participant) => participant.id === participantId)
  ) {
    return { groupActivity: null }
  }

  if (!isActivityAvailable(groupActivity)) return { groupActivity: null }

  const groupMembers = group.participants
  if (groupMembers.length < 2) return { groupActivity: null }

  try {
    const activityInstance = await prisma.$transaction(async (tx) => {
      const createdInstance = await tx.groupActivityInstance.create({
        data: {
          group: { connect: { id: groupId } },
          groupActivity: { connect: { id: activityId } },
          clues: { create: groupActivity.clues },
        },
        select: {
          id: true,
          clues: {
            select: { id: true },
          },
        },
      })

      const shuffledClues = shuffleItems(createdInstance.clues)
      const clueAssignments = groupMembers.reduce<{
        assignments: {
          groupActivityClueInstance: { connect: { id: number } }
          participant: { connect: { id: string } }
        }[]
        remainingClues: number
        remainingMembers: number
        startIx: number
      }>(
        (acc, participant) => {
          const numOfClues = Math.ceil(
            acc.remainingClues / acc.remainingMembers
          )
          const endIx = acc.startIx + numOfClues
          const participantClues = shuffledClues.slice(acc.startIx, endIx)

          return {
            remainingClues: acc.remainingClues - numOfClues,
            remainingMembers: acc.remainingMembers - 1,
            startIx: endIx,
            assignments: [
              ...acc.assignments,
              ...participantClues.map((clue) => ({
                groupActivityClueInstance: {
                  connect: { id: clue.id },
                },
                participant: {
                  connect: { id: participant.id },
                },
              })),
            ],
          }
        },
        {
          assignments: [],
          remainingClues: groupActivity.clues.length,
          remainingMembers: groupMembers.length,
          startIx: 0,
        }
      )

      return tx.groupActivityInstance.update({
        where: { id: createdInstance.id },
        data: {
          clueInstanceAssignment: {
            create: clueAssignments.assignments,
          },
        },
        select: { id: true },
      })
    })

    return {
      groupActivity: {
        id: groupActivity.id,
        status: groupActivity.status,
        activityInstance,
      },
    }
  } catch (error) {
    console.error(error)
    return { groupActivity: null }
  }
}
